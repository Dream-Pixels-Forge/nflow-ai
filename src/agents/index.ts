/**
 * NexusFlow Agents — ADK-powered agent system
 *
 * Re-exports from src/agents/agents.ts (ADK LlmAgent / FunctionTool instances).
 * Import from here:
 *   import { createAgent, coderAgent, readFileTool } from '../agents';
 */

export { LlmAgent as NexusAgent } from "@google/adk";
export { createAdkAgent as createAgent } from "../adk/agents";
export type { AgentOptions as AgentConfig } from "../adk/agents";

export { FunctionTool as Tool } from "@google/adk";

// ── Pre-built agents ────────────────────────────────────────────────
export {
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
} from "./agents";

// ── Pre-built tools ─────────────────────────────────────────────────
export {
  readFileTool,
  writeFileTool,
  runTestsTool,
  scanSecurityTool,
  deployTool,
  checkMetricsTool,
  ALL_TOOLS,
} from "./agents";
