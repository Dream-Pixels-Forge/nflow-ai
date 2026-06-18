/**
 * Pipeline: LoopAgent - types only (ADK-powered)
 *
 * Types kept for backward compatibility.
 * The LoopAgent class is deprecated — use ADK LoopAgent instead.
 */

import type { PipelineAgent, PipelineContext, PipelineExecution, AgentStatus } from './SequentialAgent';

export interface LoopPipelineConfig {
  name: string;
  description: string;
  agents: PipelineAgent[];
  maxIterations: number;
  exitCondition?: (context: PipelineContext, iteration: number) => boolean;
  exitTool?: string;
  continueOnError?: boolean;
  timeout?: number;
}

export interface LoopIteration {
  iteration: number;
  agents: Array<{
    id: string;
    status: AgentStatus;
    duration?: number;
    error?: string;
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
