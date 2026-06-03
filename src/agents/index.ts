/**
 * NexusFlow Agents - ADK-inspired agent system
 * 
 * Type-safe, composable agents with lifecycle hooks and tool validation.
 */

// Core classes
export { NexusAgent, createAgent } from './NexusAgent';
export type { AgentConfig, AgentContext, AgentResponse, LifecycleHooks } from './NexusAgent';

export { Tool, createTool } from './Tool';
export type { ToolConfig, ToolResult } from './Tool';

export { AgentOrchestrator, createOrchestrator } from './AgentOrchestrator';
export type { OrchestratorConfig, RoutingRule, HandoffRecord } from './AgentOrchestrator';

// Pre-built agents and tools
export {
  // Agents
  chatAgent,
  planAgent,
  architectAgent,
  coderAgent,
  testAgent,
  secureAgent,
  deployAgent,
  monitorAgent,
  createDevTeam,
  ALL_AGENTS,
  
  // Tools
  readFileTool,
  writeFileTool,
  runTestsTool,
  scanSecurityTool,
  deployTool,
  checkMetricsTool,
  ALL_TOOLS
} from './agents';
