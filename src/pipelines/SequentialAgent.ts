/**
 * Pipeline: SequentialAgent
 * 
 * Executes subagents in sequence, passing output from one to the next.
 * Based on ADK Sequential Pipeline from Obsidian vault.
 */

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineContext {
  state: Map<string, any>;
  input: any;
  output?: any;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface PipelineAgent {
  id: string;
  name: string;
  description: string;
  
  // Agent configuration
  instruction: string | ((context: PipelineContext) => string);
  tools: string[];
  outputKey?: string; // Key to store output in state
  
  // Execution
  execute: (input: any, context: PipelineContext) => Promise<any>;
  
  // Optional hooks
  beforeExecute?: (context: PipelineContext) => Promise<void>;
  afterExecute?: (output: any, context: PipelineContext) => Promise<void>;
  onError?: (error: Error, context: PipelineContext) => Promise<void>;
  // Validation gate: runs after execute, before output is passed to next agent
  // Return true to continue, false to fail the pipeline
  validate?: (output: unknown, context: PipelineContext) => Promise<boolean>;
}

export interface SequentialPipelineConfig {
  name: string;
  description: string;
  agents: PipelineAgent[];
  continueOnError?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentAgentIndex: number;
  results: Array<{
    agentId: string;
    agentName: string;
    status: AgentStatus;
    input?: any;
    output?: any;
    error?: string;
    duration?: number;
    startedAt?: string;
    completedAt?: string;
  }>;
  context: PipelineContext;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  error?: string;
}

/**
 * SequentialAgent - Executes agents in sequence
 */
export class SequentialAgent {
  private config: SequentialPipelineConfig;
  private executions: Map<string, PipelineExecution> = new Map();

  constructor(config: SequentialPipelineConfig) {
    this.config = {
      continueOnError: false,
      maxRetries: 3,
      timeout: 300000, // 5 minutes
      ...config
    };
  }

  /**
   * Execute the sequential pipeline
   */
  async execute(input: any, initialState?: Record<string, any>): Promise<PipelineExecution> {
    const execution: PipelineExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pipelineId: this.config.name,
      status: 'running',
      currentAgentIndex: 0,
      results: [],
      context: {
        state: new Map(Object.entries(initialState || {})),
        input,
        metadata: {},
        timestamp: new Date().toISOString()
      },
      startedAt: new Date().toISOString()
    };

    this.executions.set(execution.id, execution);

    try {
      let currentInput = input;

      for (let i = 0; i < this.config.agents.length; i++) {
        const agent = this.config.agents[i];
        execution.currentAgentIndex = i;

        const result: {
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

        execution.results.push(result);

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
          // Validation gate: verify output before passing to next agent
          if (agent.validate) {
            const isValid = await agent.validate(output, execution.context);
            if (!isValid) {
              result.status = 'failed';
              result.error = `Validation failed for agent "${agent.name}"`;
              result.completedAt = new Date().toISOString();
              result.duration = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime();

              if (!this.config.continueOnError) {
                execution.status = 'failed';
                execution.error = result.error;
                execution.completedAt = new Date().toISOString();
                execution.totalDuration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();
                return execution;
              }
              continue; // Skip to next agent if continueOnError
            }
          }

          // Update result
          result.status = 'completed';
          result.output = output;
          result.completedAt = new Date().toISOString();
          result.duration = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime();

          // Pass output to next agent
          currentInput = output;

        } catch (error) {
          result.status = 'failed';
          result.error = error instanceof Error ? error.message : 'Unknown error';
          result.completedAt = new Date().toISOString();
          result.duration = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime();

          // Execute error hook
          if (agent.onError) {
            await agent.onError(error as Error, execution.context);
          }

          // Check if we should continue
          if (!this.config.continueOnError) {
            execution.status = 'failed';
            execution.error = result.error;
            break;
          }
        }
      }

      // Set final status
      if (execution.status === 'running') {
        const hasFailures = execution.results.some(r => r.status === 'failed');
        execution.status = hasFailures ? 'failed' : 'completed';
      }

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown pipeline error';
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
      setTimeout(() => reject(new Error(`Pipeline timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): PipelineExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions
   */
  getExecutions(): PipelineExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get pipeline config
   */
  getConfig(): SequentialPipelineConfig {
    return { ...this.config };
  }

  /**
   * Get pipeline stats
   */
  getStats(): {
    totalExecutions: number;
    completed: number;
    failed: number;
    averageDuration: number;
  } {
    const executions = Array.from(this.executions.values());
    const completed = executions.filter(e => e.status === 'completed');
    const failed = executions.filter(e => e.status === 'failed');

    const totalDuration = completed.reduce((sum, e) => sum + (e.totalDuration || 0), 0);

    return {
      totalExecutions: executions.length,
      completed: completed.length,
      failed: failed.length,
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
 * Helper to create a pipeline agent from a simple function
 */
export function createAgent(
  id: string,
  name: string,
  executeFn: (input: any, context: PipelineContext) => Promise<any>,
  options?: Partial<PipelineAgent>
): PipelineAgent {
  return {
    id,
    name,
    description: options?.description || `Agent: ${name}`,
    instruction: options?.instruction || '',
    tools: options?.tools || [],
    outputKey: options?.outputKey,
    execute: executeFn,
    beforeExecute: options?.beforeExecute,
    afterExecute: options?.afterExecute,
    onError: options?.onError
  };
}
