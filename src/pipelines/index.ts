/**
 * Pipelines Index — ADK-powered
 *
 * Re-exports ADK SequentialAgent / LoopAgent / ParallelAgent alongside
 * custom pipeline utilities (GraphWorkflow, HITLManager, etc.)
 */

// ── ADK pipeline primitives ─────────────────────────────────────────
export {
  SequentialAgent,
  LoopAgent,
  ParallelAgent,
} from "@google/adk";

// ── Custom pipeline utilities (no ADK equivalent) ────────────────────

// Graph-Based Workflow Router
export { GraphWorkflow } from './GraphWorkflow';
export type {
  GraphNode,
  GraphEdge,
  GraphWorkflowConfig,
  GraphStep,
  GraphExecution,
} from './GraphWorkflow';

// Human-in-the-Loop
export { HITLManager, hitlManager } from './HITLManager';
export type {
  HITLRequest,
  HITLResponse,
} from './HITLManager';

// Pipeline Orchestrator (wraps ADK Runner)
export { PipelineOrchestrator, pipelineOrchestrator } from './PipelineOrchestrator';
export type {
  PipelineType,
  PipelineConfig,
  PipelineInfo,
  OrchestratorStats,
} from './PipelineOrchestrator';

// Dynamic Instructions (utility)
export { DynamicInstructionGenerator, InstructionTemplates, createInstructionProvider } from './DynamicInstructions';
export type {
  InstructionType,
  InstructionDefinition,
  ConditionalBranch,
} from './DynamicInstructions';

// State Keys & Output Keys (bridges to ADK State)
export {
  StateKey,
  OutputKey,
  CommonStateKeys,
  CommonOutputKeys,
  StateManager,
  createStateManager,
} from './StateKeys';
export type { OutputKeyConfig } from './StateKeys';

// Sequential Agent types (for GraphWorkflow and usePipelines compatibility)
export { createAgent } from './SequentialAgent';
export type {
  AgentStatus,
  PipelineContext,
  PipelineAgent,
  SequentialPipelineConfig,
  PipelineExecution,
} from './SequentialAgent';

// Loop Agent types
export type {
  LoopPipelineConfig,
  LoopIteration,
  LoopExecution,
} from './LoopAgent';
