/**
 * Pipeline: LoopAgent
 * 
 * Executes subagents in a loop until a condition is met or max iterations reached.
 * Based on ADK Loop Pipeline from Obsidian vault.
 */

import { PipelineAgent, PipelineContext, PipelineExecution, AgentStatus } from './SequentialAgent';

export interface LoopPipelineConfig {
  name: string;
  description: string;
  agents: PipelineAgent[];
  maxIterations: number;
  exitCondition?: (context: PipelineContext, iteration: number) => boolean;
  exitTool?: string; // Tool name that signals loop exit
  continueOnError?: boolean;
  timeout?: number;
}

export interface LoopIteration {
  iteration: number;
  agents: Array<{
    agentId: string;
    agentName: string;
    status: AgentStatus;
    input?: any;
    output?: any;
    error?: string;
    duration?: number;
  }>;
  startedAt: string;
  completedAt?: string;
  exitTriggered?: boolean;
}

export interface LoopExecution {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'max-iterations';
  iterations: LoopIteration[];
  context: PipelineContext;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  totalIterations: number;
  error?: string;
}

/**
 * LoopAgent - Executes agents in a loop
 */
export class LoopAgent {
  private config: LoopPipelineConfig;
  private executions: Map<string, LoopExecution> = new Map();

  constructor(config: LoopPipelineConfig) {
    this.config = {
      continueOnError: false,
      timeout: 600000, // 10 minutes
      ...config
    };
  }

  /**
   * Execute the loop pipeline
   */
  async execute(input: any, initialState?: Record<string, any>): Promise<LoopExecution> {
    const execution: LoopExecution = {
      id: `loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pipelineId: this.config.name,
      status: 'running',
      iterations: [],
      context: {
        state: new Map(Object.entries(initialState || {})),
        input,
        metadata: {},
        timestamp: new Date().toISOString()
      },
      startedAt: new Date().toISOString(),
      totalIterations: 0
    };

    this.executions.set(execution.id, execution);

    try {
      let currentInput = input;
      let iteration = 0;
      let shouldExit = false;

      while (iteration < this.config.maxIterations && !shouldExit) {
        execution.totalIterations = iteration + 1;

        const loopIteration: LoopIteration = {
          iteration: iteration + 1,
          agents: [],
          startedAt: new Date().toISOString()
        };

        execution.iterations.push(loopIteration);

        // Execute all agents in sequence within this iteration
        for (const agent of this.config.agents) {
          const agentResult: {
            agentId: string;
            agentName: string;
            status: AgentStatus;
            input: any;
            output?: any;
            error?: string;
            duration?: number;
            startedAt: string;
            completedAt?: string;
          } = {
            agentId: agent.id,
            agentName: agent.name,
            status: 'running',
            input: currentInput,
            startedAt: new Date().toISOString()
          };

          loopIteration.agents.push(agentResult);

          try {
            // Execute before hook
            if (agent.beforeExecute) {
              await agent.beforeExecute(execution.context);
            }

            // Get instruction (static or dynamic)
            const instruction = typeof agent.instruction === 'function'
              ? agent.instruction(execution.context)
              : agent.instruction;

            // Execute agent
            const output = await Promise.race([
              agent.execute(currentInput, execution.context),
              this.createTimeout(this.config.timeout!)
            ]);

            // Store output in state if outputKey is defined
            if (agent.outputKey) {
              execution.context.state.set(agent.outputKey, output);
            }

            // Execute after hook
            if (agent.afterExecute) {
              await agent.afterExecute(output, execution.context);
            }
            // Validation gate
            if (agent.validate) {
              const isValid = await agent.validate(output, execution.context);
              if (!isValid) {
                agentResult.status = 'failed';
                agentResult.error = `Validation failed for agent "${agent.name}"`;
                agentResult.completedAt = new Date().toISOString();
                agentResult.duration = new Date(agentResult.completedAt).getTime() - new Date(agentResult.startedAt).getTime();

                if (!this.config.continueOnError) {
                  execution.status = 'failed';
                  execution.error = agentResult.error;
                  execution.completedAt = new Date().toISOString();
                  execution.totalDuration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();
                  return execution;
                }
                continue;
              }
            }

            // Update result
            agentResult.status = 'completed';
            agentResult.output = output;
            agentResult.completedAt = new Date().toISOString();
            agentResult.duration = new Date(agentResult.completedAt).getTime() - new Date(agentResult.startedAt).getTime();

            // Pass output to next agent
            currentInput = output;

            // Check for exit tool
            if (this.config.exitTool && agent.tools.includes(this.config.exitTool)) {
              // Check if the output signals exit
              if (output && typeof output === 'object' && output.exit) {
                shouldExit = true;
                loopIteration.exitTriggered = true;
              }
            }

          } catch (error) {
            agentResult.status = 'failed';
            agentResult.error = error instanceof Error ? error.message : 'Unknown error';
            agentResult.completedAt = new Date().toISOString();
            agentResult.duration = new Date(agentResult.completedAt).getTime() - new Date(agentResult.startedAt).getTime();

            // Check if we should continue
            if (!this.config.continueOnError) {
              execution.status = 'failed';
              execution.error = agentResult.error;
              shouldExit = true;
            }
          }
        }

        loopIteration.completedAt = new Date().toISOString();

        // Check exit condition
        if (this.config.exitCondition) {
          shouldExit = this.config.exitCondition(execution.context, iteration + 1);
          if (shouldExit) {
            loopIteration.exitTriggered = true;
          }
        }

        iteration++;
      }

      // Set final status
      if (execution.status === 'running') {
        if (iteration >= this.config.maxIterations) {
          execution.status = 'max-iterations';
        } else {
          const hasFailures = execution.iterations.some(iter => 
            iter.agents.some(a => a.status === 'failed')
          );
          execution.status = hasFailures ? 'failed' : 'completed';
        }
      }

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown loop error';
    }

    execution.completedAt = new Date().toISOString();
    execution.totalDuration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();

    return execution;
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Loop timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): LoopExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions
   */
  getExecutions(): LoopExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get pipeline config
   */
  getConfig(): LoopPipelineConfig {
    return { ...this.config };
  }

  /**
   * Get pipeline stats
   */
  getStats(): {
    totalExecutions: number;
    completed: number;
    failed: number;
    maxIterationsReached: number;
    averageIterations: number;
    averageDuration: number;
  } {
    const executions = Array.from(this.executions.values());
    const completed = executions.filter(e => e.status === 'completed');
    const failed = executions.filter(e => e.status === 'failed');
    const maxIter = executions.filter(e => e.status === 'max-iterations');

    const totalIterations = completed.reduce((sum, e) => sum + e.totalIterations, 0);
    const totalDuration = completed.reduce((sum, e) => sum + (e.totalDuration || 0), 0);

    return {
      totalExecutions: executions.length,
      completed: completed.length,
      failed: failed.length,
      maxIterationsReached: maxIter.length,
      averageIterations: completed.length > 0 ? totalIterations / completed.length : 0,
      averageDuration: completed.length > 0 ? totalDuration / completed.length : 0
    };
  }

  /**
   * Clear executions
   */
  clearExecutions(): void {
    this.executions.clear();
  }
}

/**
 * Helper to create a loop pipeline
 */
export function createLoopPipeline(
  name: string,
  agents: PipelineAgent[],
  maxIterations: number,
  options?: Partial<LoopPipelineConfig>
): LoopAgent {
  return new LoopAgent({
    name,
    description: options?.description || `Loop Pipeline: ${name}`,
    agents,
    maxIterations,
    ...options
  });
}
