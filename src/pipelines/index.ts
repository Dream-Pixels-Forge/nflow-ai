/**
 * Pipelines Index
 * 
 * Exports all pipeline components
 */

// Sequential Agent
export { SequentialAgent, createAgent } from './SequentialAgent';
export type {
  AgentStatus,
  PipelineContext,
  PipelineAgent,
  SequentialPipelineConfig,
  PipelineExecution
} from './SequentialAgent';

// Loop Agent
export { LoopAgent, createLoopPipeline } from './LoopAgent';
export type {
  LoopPipelineConfig,
  LoopIteration,
  LoopExecution
} from './LoopAgent';

// Dynamic Instructions
export { DynamicInstructionGenerator, InstructionTemplates, createInstructionProvider } from './DynamicInstructions';
export type {
  InstructionType,
  InstructionDefinition,
  ConditionalBranch
} from './DynamicInstructions';

// State Keys & Output Keys
export {
  StateKey,
  OutputKey,
  CommonStateKeys,
  CommonOutputKeys,
  StateManager,
  createStateManager
} from './StateKeys';
export type { OutputKeyConfig } from './StateKeys';

// Pipeline Orchestrator
export { PipelineOrchestrator, pipelineOrchestrator } from './PipelineOrchestrator';
export type {
  PipelineType,
  PipelineConfig,
  PipelineInfo,
  OrchestratorStats
} from './PipelineOrchestrator';
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
