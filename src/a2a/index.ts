/**
 * A2A Protocol Index
 * 
 * Exports all A2A Protocol components
 */

// Agent Cards
export { AgentCardManager, agentCardManager } from './AgentCard';
export type {
  AgentCapability,
  AgentAuthentication,
  AgentEndpoints,
  AgentCard,
  AgentCardRegistry
} from './AgentCard';

// Task Lifecycle
export { TaskManager, taskManager } from './TaskManager';
export type {
  TaskState,
  TaskPriority,
  TaskMessage,
  TaskPart,
  TaskArtifact,
  Task,
  TaskSubscription,
  TaskCreateRequest,
  TaskUpdateRequest
} from './TaskManager';

// SSE (Server-Sent Events)
export { SSEManager, sseManager } from './SSEManager';
export type {
  SSEConnection,
  SSEEvent,
  SSEConfig
} from './SSEManager';
