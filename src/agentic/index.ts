/**
 * NexusFlow Agentic Systems Index
 * 
 * Complete agentic infrastructure based on Obsidian vault knowledge:
 * - A2A Protocol (Agent-to-Agent Communication)
 * - MCP Integration (Model Context Protocol)
 * - Persistent Memory System
 * - Core Agentic Systems (Orchestrator, EmergencyStop, Drift, Gates, Context)
 */

// Core Agentic Systems
export {
  AgentOrchestrator,
  agentOrchestrator,
  PHASE_CONFIGS
} from './AgentOrchestrator';
export type {
  AgentPhase,
  AgentStatus,
  HeartbeatPulse,
  AgentState,
  PhaseConfig
} from './AgentOrchestrator';

export { EmergencyStop, emergencyStop } from './EmergencyStop';
export type {
  EmergencySeverity,
  EmergencyEvent,
  EmergencyAction,
  EmergencyConfig
} from './EmergencyStop';

export { BehavioralDrift, behavioralDrift } from './BehavioralDrift';
export type {
  DriftSeverity,
  DriftEvent,
  DriftType,
  PhaseConstraintSet,
  DriftConfig
} from './BehavioralDrift';

export { PhaseGate, phaseGate } from './PhaseGate';
export type {
  GateStatus,
  PhaseGateEvent,
  GateCriteria,
  GateContext,
  GateMetrics,
  PhaseGateConfig
} from './PhaseGate';

export { ContextManager, contextManager } from './ContextManager';
export type {
  ContextStatus,
  ContextSession,
  MCPServerState,
  ConversationMessage,
  ContextConfig
} from './ContextManager';

// A2A Protocol
export {
  AgentCardManager,
  agentCardManager
} from '../a2a/AgentCard';
export type {
  AgentCapability,
  AgentAuthentication,
  AgentEndpoints,
  AgentCard,
  AgentCardRegistry
} from '../a2a/AgentCard';

export { TaskManager, taskManager } from '../a2a/TaskManager';
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
} from '../a2a/TaskManager';

export { SSEManager, sseManager } from '../a2a/SSEManager';
export type {
  SSEConnection,
  SSEEvent,
  SSEConfig
} from '../a2a/SSEManager';

// MCP Integration
export { MCPManager, mcpManager } from '../mcp/MCPManager';
export type {
  MCPTool,
  MCPServer,
  MCPResource,
  MCPPrompt,
  MCPConnection,
  MCPConfig
} from '../mcp/MCPManager';

// Persistent Memory
export { MemoryManager, memoryManager } from '../memory/MemoryManager';
export type {
  MemoryType,
  MemoryEntry,
  MemoryQuery,
  MemoryStats,
  MemoryConfig
} from '../memory/MemoryManager';
