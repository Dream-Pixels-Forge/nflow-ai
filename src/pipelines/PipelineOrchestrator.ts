/**
 * Pipeline Orchestrator
 * 
 * Central coordinator for all pipeline types.
 * Based on ADK Pipeline patterns from Obsidian vault.
 */

import { SequentialAgent, PipelineAgent, PipelineContext, PipelineExecution, createAgent } from './SequentialAgent';
import { LoopAgent, LoopPipelineConfig, LoopExecution, createLoopPipeline } from './LoopAgent';
import { DynamicInstructionGenerator, InstructionTemplates, InstructionDefinition } from './DynamicInstructions';
import { StateKey, OutputKey, CommonStateKeys, CommonOutputKeys, StateManager, createStateManager } from './StateKeys';

export type PipelineType = 'sequential' | 'loop';

export interface PipelineConfig {
  type: PipelineType;
  name: string;
  description: string;
  agents: PipelineAgent[];
  
  // Sequential-specific
  continueOnError?: boolean;
  
  // Loop-specific
  maxIterations?: number;
  exitCondition?: (context: PipelineContext, iteration: number) => boolean;
  exitTool?: string;
  
  // Common
  timeout?: number;
  maxRetries?: number;
}

export interface PipelineInfo {
  id: string;
  name: string;
  type: PipelineType;
  description: string;
  agentCount: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastExecution?: string;
  executionCount: number;
}

export interface OrchestratorStats {
  totalPipelines: number;
  sequentialPipelines: number;
  loopPipelines: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
}

/**
 * Pipeline Orchestrator - Manages all pipelines
 */
export class PipelineOrchestrator {
  private pipelines: Map<string, SequentialAgent | LoopAgent> = new Map();
  private pipelineConfigs: Map<string, PipelineConfig> = new Map();
  private instructionGenerator: DynamicInstructionGenerator;
  private executionHistory: Map<string, PipelineExecution | LoopExecution> = new Map();

  constructor() {
    this.instructionGenerator = new DynamicInstructionGenerator();
    this.registerDefaultInstructions();
  }

  /**
   * Register default instruction templates
   */
  private registerDefaultInstructions(): void {
    // Register common instruction templates
    this.instructionGenerator.registerDynamic('code_analyzer', InstructionTemplates.codeReview);
    this.instructionGenerator.registerDynamic('style_checker', InstructionTemplates.styleCheck);
    this.instructionGenerator.registerDynamic('test_runner', InstructionTemplates.testGeneration);
    this.instructionGenerator.registerDynamic('code_fixer', InstructionTemplates.codeFix);
    this.instructionGenerator.registerDynamic('synthesizer', InstructionTemplates.synthesis);
  }

  /**
   * Create a sequential pipeline
   */
  createSequentialPipeline(config: {
    name: string;
    description: string;
    agents: PipelineAgent[];
    continueOnError?: boolean;
    timeout?: number;
  }): SequentialAgent {
    const pipelineConfig: PipelineConfig = {
      type: 'sequential',
      ...config
    };

    const pipeline = new SequentialAgent({
      name: config.name,
      description: config.description,
      agents: config.agents,
      continueOnError: config.continueOnError,
      timeout: config.timeout
    });

    this.pipelines.set(config.name, pipeline);
    this.pipelineConfigs.set(config.name, pipelineConfig);

    return pipeline;
  }

  /**
   * Create a loop pipeline
   */
  createLoopPipeline(config: {
    name: string;
    description: string;
    agents: PipelineAgent[];
    maxIterations: number;
    exitCondition?: (context: PipelineContext, iteration: number) => boolean;
    exitTool?: string;
    continueOnError?: boolean;
    timeout?: number;
  }): LoopAgent {
    const pipelineConfig: PipelineConfig = {
      type: 'loop',
      ...config
    };

    const pipeline = new LoopAgent({
      name: config.name,
      description: config.description,
      agents: config.agents,
      maxIterations: config.maxIterations,
      exitCondition: config.exitCondition,
      exitTool: config.exitTool,
      continueOnError: config.continueOnError,
      timeout: config.timeout
    });

    this.pipelines.set(config.name, pipeline);
    this.pipelineConfigs.set(config.name, pipelineConfig);

    return pipeline;
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(
    pipelineName: string,
    input: any,
    initialState?: Record<string, any>
  ): Promise<PipelineExecution | LoopExecution> {
    const pipeline = this.pipelines.get(pipelineName);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineName}`);
    }

    const execution = await pipeline.execute(input, initialState);
    this.executionHistory.set(execution.id, execution);

    return execution;
  }

  /**
   * Get pipeline by name
   */
  getPipeline(name: string): SequentialAgent | LoopAgent | undefined {
    return this.pipelines.get(name);
  }

  /**
   * Get all pipelines
   */
  getPipelines(): PipelineInfo[] {
    return Array.from(this.pipelineConfigs.entries()).map(([name, config]) => {
      const pipeline = this.pipelines.get(name);
      const stats = pipeline ? this.getPipelineStats(name) : null;

      return {
        id: name,
        name,
        type: config.type,
        description: config.description,
        agentCount: config.agents.length,
        status: 'idle',
        executionCount: stats?.totalExecutions || 0
      };
    });
  }

  /**
   * Get pipeline stats
   */
  getPipelineStats(name: string): any {
    const pipeline = this.pipelines.get(name);
    if (!pipeline) return null;

    if (pipeline instanceof SequentialAgent) {
      return pipeline.getStats();
    } else if (pipeline instanceof LoopAgent) {
      return pipeline.getStats();
    }

    return null;
  }

  /**
   * Get orchestrator stats
   */
  getStats(): OrchestratorStats {
    const configs = Array.from(this.pipelineConfigs.values());
    const sequential = configs.filter(c => c.type === 'sequential').length;
    const loop = configs.filter(c => c.type === 'loop').length;

    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let totalDuration = 0;

    this.executionHistory.forEach(execution => {
      totalExecutions++;
      if (execution.status === 'completed') {
        successfulExecutions++;
        totalDuration += execution.totalDuration || 0;
      } else if (execution.status === 'failed') {
        failedExecutions++;
      }
    });

    return {
      totalPipelines: configs.length,
      sequentialPipelines: sequential,
      loopPipelines: loop,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime: successfulExecutions > 0 ? totalDuration / successfulExecutions : 0
    };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): (PipelineExecution | LoopExecution)[] {
    return Array.from(this.executionHistory.values());
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): PipelineExecution | LoopExecution | undefined {
    return this.executionHistory.get(executionId);
  }

  /**
   * Register custom instruction
   */
  registerInstruction(agentId: string, instruction: string | ((context: PipelineContext) => string)): void {
    if (typeof instruction === 'string') {
      this.instructionGenerator.registerStatic(agentId, instruction);
    } else {
      this.instructionGenerator.registerDynamic(agentId, instruction);
    }
  }

  /**
   * Get instruction for agent
   */
  getInstruction(agentId: string, context: PipelineContext): string {
    return this.instructionGenerator.generate(agentId, context);
  }

  /**
   * Delete pipeline
   */
  deletePipeline(name: string): boolean {
    const deleted = this.pipelines.delete(name);
    this.pipelineConfigs.delete(name);
    return deleted;
  }

  /**
   * Clear all pipelines and history
   */
  clear(): void {
    this.pipelines.clear();
    this.pipelineConfigs.clear();
    this.executionHistory.clear();
    this.instructionGenerator.clear();
  }
}

// Singleton instance
export const pipelineOrchestrator = new PipelineOrchestrator();

// Export all pipeline components
export { SequentialAgent, createAgent } from './SequentialAgent';
export { LoopAgent, createLoopPipeline } from './LoopAgent';
export { DynamicInstructionGenerator, InstructionTemplates } from './DynamicInstructions';
export { StateKey, OutputKey, CommonStateKeys, CommonOutputKeys, StateManager, createStateManager } from './StateKeys';
export type { PipelineAgent, PipelineContext, PipelineExecution, AgentStatus } from './SequentialAgent';
export type { LoopPipelineConfig, LoopExecution } from './LoopAgent';
export type { InstructionType, InstructionDefinition, ConditionalBranch } from './DynamicInstructions';
export type { OutputKeyConfig } from './StateKeys';
