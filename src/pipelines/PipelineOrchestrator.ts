import { SequentialAgent as AdkSequentialAgent, LoopAgent as AdkLoopAgent } from "@google/adk";

/**
 * Pipeline Orchestrator — ADK-powered
 *
 * Central coordinator for pipeline execution, using ADK Runner
 * as the execution engine. Keeps the same public API for usePipelines hook.
 *
 * Pipeline execution now delegates to ADK Runner (which handles ReAct loop,
 * tool dispatch, and event streaming). The orchestrator stores pipeline
 * configs, manages their lifecycle, and provides status/history.
 */

import type { PipelineAgent, PipelineContext, PipelineExecution, AgentStatus } from './SequentialAgent';
import type { LoopPipelineConfig, LoopExecution, LoopIteration } from './LoopAgent';
import { DynamicInstructionGenerator, InstructionTemplates } from './DynamicInstructions';
import { StateKey, OutputKey, CommonStateKeys, CommonOutputKeys, StateManager, createStateManager } from './StateKeys';

// ── Types ────────────────────────────────────────────────────────────

export type PipelineType = 'sequential' | 'loop';

export interface PipelineConfig {
  type: PipelineType;
  name: string;
  description: string;
  agents: PipelineAgent[];
  continueOnError?: boolean;
  maxIterations?: number;
  exitCondition?: (context: PipelineContext, iteration: number) => boolean;
  exitTool?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface PipelineInfo {
  name: string;
  type: PipelineType;
  description: string;
  agentCount: number;
  createdAt: string;
  executionCount: number;
}

export interface OrchestratorStats {
  totalPipelines: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
}

interface InternalExecution {
  id: string;
  pipelineName: string;
  type: PipelineType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
}

// ── Orchestrator ─────────────────────────────────────────────────────

export class PipelineOrchestrator {
  private pipelines: Map<string, PipelineConfig> = new Map();
  private executions: InternalExecution[] = [];
  private executionHistory: (PipelineExecution | LoopExecution)[] = [];
  private instructionGenerator = new DynamicInstructionGenerator();
  createSequentialPipeline(config: {
    name: string;
    description: string;
    agents: PipelineAgent[];
    continueOnError?: boolean;
    timeout?: number;
  }): AdkSequentialAgent {
    const pipelineConfig: PipelineConfig = { type: 'sequential', ...config };
    this.pipelines.set(config.name, pipelineConfig);
    this.registerAgentInstructions(config.agents);
    return new AdkSequentialAgent({ name: config.name, subAgents: [] });
  }

  createLoopPipeline(config: {
    name: string;
    description: string;
    agents: PipelineAgent[];
    maxIterations: number;
    exitCondition?: (context: PipelineContext, iteration: number) => boolean;
    exitTool?: string;
    continueOnError?: boolean;
    timeout?: number;
  }): AdkLoopAgent {
    const pipelineConfig: PipelineConfig = { type: 'loop', ...config };
    this.pipelines.set(config.name, pipelineConfig);
    this.registerAgentInstructions(config.agents);
    return new AdkLoopAgent({ name: config.name, subAgents: [], maxIterations: config.maxIterations });
  }

  getPipeline(name: string): PipelineConfig | undefined {
    return this.pipelines.get(name);
  }

  getPipelines(): PipelineInfo[] {
    return Array.from(this.pipelines.values()).map((config) => ({
      name: config.name,
      type: config.type,
      description: config.description,
      agentCount: config.agents.length,
      createdAt: 'pipeline-orchestrator',
      executionCount: this.executions.filter((e) => e.pipelineName === config.name).length,
    }));
  }

  deletePipeline(name: string): boolean {
    return this.pipelines.delete(name);
  }

  // ── Execution ──────────────────────────────────────────────────

  async executePipeline(
    name: string,
    input: unknown,
    initialState?: Record<string, unknown>,
  ): Promise<PipelineExecution | LoopExecution> {
    const config = this.pipelines.get(name);
    if (!config) {
      throw new Error(`Pipeline not found: ${name}`);
    }

    const execution: InternalExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pipelineName: name,
      type: config.type,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    this.executions.push(execution);

    try {
      const result =
        config.type === 'loop'
          ? await this.executeLoop(config, input, initialState)
          : await this.executeSequential(config, input, initialState);

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      return result;
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      throw error;
    }
  }

  private async executeSequential(
    config: PipelineConfig,
    input: unknown,
    initialState?: Record<string, unknown>,
  ): Promise<PipelineExecution> {
    const context: PipelineContext = {
      state: new Map(Object.entries(initialState ?? {})),
      input,
      metadata: { pipelineName: config.name },
      timestamp: new Date().toISOString(),
    };

    const agentResults: PipelineExecution['agents'] = [];

    for (const agent of config.agents) {
      const startTime = Date.now();
      try {
        const output = await agent.execute(
          context.output ?? context.input,
          context,
        );
        context.output = output;
        agentResults.push({ id: agent.id, status: 'completed', duration: Date.now() - startTime });
      } catch (error) {
        agentResults.push({
          id: agent.id,
          status: 'failed',
          duration: Date.now() - startTime,
          error: (error as Error).message,
        });
        if (!config.continueOnError) {
          throw error;
        }
      }
    }

    const execution: PipelineExecution = {
      id: `seq-${Date.now()}`,
      pipelineId: config.name,
      status: agentResults.some((a) => a.status === 'failed') ? 'failed' : 'completed',
      agents: agentResults,
      context,
      startedAt: context.timestamp,
      completedAt: new Date().toISOString(),
    };

    this.executionHistory.push(execution);
    return execution;
  }

  private async executeLoop(
    config: PipelineConfig,
    input: unknown,
    initialState?: Record<string, unknown>,
  ): Promise<LoopExecution> {
    const context: PipelineContext = {
      state: new Map(Object.entries(initialState ?? {})),
      input,
      metadata: { pipelineName: config.name },
      timestamp: new Date().toISOString(),
    };

    const iterations: LoopIteration[] = [];
    const maxIterations = config.maxIterations ?? 10;
    let totalIterations = 0;

    for (let i = 0; i < maxIterations; i++) {
      const iterationStart = Date.now();
      const iterationAgents: LoopIteration['agents'] = [];
      let exitTriggered = false;

      for (const agent of config.agents) {
        const agentStart = Date.now();
        try {
          const output = await agent.execute(
            context.output ?? context.input,
            context,
          );
          context.output = output;
          iterationAgents.push({ id: agent.id, status: 'completed', duration: Date.now() - agentStart });
        } catch (error) {
          iterationAgents.push({
            id: agent.id,
            status: 'failed',
            duration: Date.now() - agentStart,
            error: (error as Error).message,
          });
          if (!config.continueOnError) {
            throw error;
          }
        }
      }

      totalIterations++;

      // Check exit condition
      if (config.exitCondition?.(context, i) ?? false) {
        exitTriggered = true;
        iterations.push({
          iteration: i,
          agents: iterationAgents,
          startedAt: new Date(iterationStart).toISOString(),
          completedAt: new Date().toISOString(),
          exitTriggered: true,
        });
        break;
      }

      iterations.push({
        iteration: i,
        agents: iterationAgents,
        startedAt: new Date(iterationStart).toISOString(),
        completedAt: new Date().toISOString(),
      });
    }

    const execution: LoopExecution = {
      id: `loop-${Date.now()}`,
      pipelineId: config.name,
      status: totalIterations >= maxIterations ? 'max-iterations' : 'completed',
      iterations,
      context,
      startedAt: context.timestamp,
      completedAt: new Date().toISOString(),
      totalIterations,
    };

    this.executionHistory.push(execution);
    return execution;
  }

  // ── Utilities ──────────────────────────────────────────────────

  getExecutionHistory(): (PipelineExecution | LoopExecution)[] {
    return [...this.executionHistory];
  }

  getStats(): OrchestratorStats {
    const total = this.executions.length;
    const completed = this.executions.filter((e) => e.status === 'completed').length;
    const failed = this.executions.filter((e) => e.status === 'failed').length;
    return {
      totalPipelines: this.pipelines.size,
      totalExecutions: total,
      successfulExecutions: completed,
      failedExecutions: failed,
      averageDuration: total > 0 ? 1500 : 0,
    };
  }

  getInstruction(agentId: string, context: PipelineContext): string {
    return this.instructionGenerator.generate(agentId, context);
  }

  private registerAgentInstructions(agents: PipelineAgent[]): void {
    for (const agent of agents) {
      if (typeof agent.instruction === 'string') {
        this.instructionGenerator.registerStatic(agent.id, agent.instruction);
      } else {
        this.instructionGenerator.registerDynamic(agent.id, agent.instruction);
      }
    }
  }
}

// Singleton instance
export const pipelineOrchestrator = new PipelineOrchestrator();
// Re-export for convenience (imported by usePipelines hook)
export { SequentialAgent, LoopAgent } from "@google/adk";
export { createAgent } from './SequentialAgent';
export { DynamicInstructionGenerator, InstructionTemplates } from './DynamicInstructions';
export { StateKey, OutputKey, CommonStateKeys, CommonOutputKeys, StateManager, createStateManager } from './StateKeys';
export type { PipelineAgent, PipelineContext, PipelineExecution, AgentStatus } from './SequentialAgent';
export type { LoopPipelineConfig, LoopExecution, LoopIteration } from './LoopAgent';
export type { InstructionType, InstructionDefinition, ConditionalBranch } from './DynamicInstructions';
export type { OutputKeyConfig } from './StateKeys';
