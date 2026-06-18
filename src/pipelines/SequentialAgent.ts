/**
 * Pipeline: SequentialAgent - types and helper (ADK-powered)
 *
 * Types kept for GraphWorkflow and GraphWorkflowPanel compatibility.
 * The SequentialAgent class is deprecated — use ADK SequentialAgent instead.
 */

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineContext {
  state: Map<string, unknown>;
  input: unknown;
  output?: unknown;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface PipelineAgent {
  id: string;
  name: string;
  description: string;
  instruction: string | ((context: PipelineContext) => string);
  tools: string[];
  outputKey?: string;
  execute: (input: unknown, context: PipelineContext) => Promise<unknown>;
  beforeExecute?: (context: PipelineContext) => Promise<void>;
  afterExecute?: (output: unknown, context: PipelineContext) => Promise<void>;
  onError?: (error: Error, context: PipelineContext) => Promise<void>;
  validate?: (output: unknown, context: PipelineContext) => Promise<boolean>;
}

export interface SequentialPipelineConfig {
  name: string;
  description: string;
  agents: PipelineAgent[];
  continueOnError?: boolean;
  outputKey?: string;
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agents: Array<{
    id: string;
    status: AgentStatus;
    duration?: number;
    error?: string;
  }>;
  context: PipelineContext;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  error?: string;
}

/**
 * Helper to create a pipeline agent from a simple function.
 * Used by GraphWorkflowPanel template definitions.
 */
export function createAgent(
  id: string,
  name: string,
  executeFn: (input: unknown, context: PipelineContext) => Promise<unknown>,
  options?: Partial<PipelineAgent>,
): PipelineAgent {
  return {
    id,
    name,
    description: `${name} agent`,
    instruction: `Execute ${name} step.`,
    tools: [],
    execute: executeFn,
    ...options,
  };
}
