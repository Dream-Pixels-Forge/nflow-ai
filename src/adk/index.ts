/**
 * ADK TypeScript Integration Layer
 *
 * Bridges nflow-ai's custom agent system with Google Agent Development Kit (ADK).
 *
 * This is the single import target for all ADK-related functionality.
 * Import from here instead of directly from @google/adk.
 */

// ── ADK re-exports (from @google/adk) ───────────────────────────────
export {
  LlmAgent,
  FunctionTool,
  SequentialAgent,
  LoopAgent,
  ParallelAgent,
  Runner,
  InMemorySessionService,
  InMemoryMemoryService,
  InMemoryArtifactService,
  SecurityPlugin,
} from "@google/adk";

export type {
  Event,
  RunConfig,
  State,
  BasePlugin,
  BaseSessionService,
  BaseMemoryService,
  BaseArtifactService,
} from "@google/adk";

// Content type comes from @google/genai (already in project deps)
import type { Content as GenAIContent } from "@google/genai";
export type { GenAIContent as Content };

// ── Type mappings ───────────────────────────────────────────────────
export {
  agentModeToName,
  agentModeToDescription,
  messagesToContent,
  toolStateToContext,
  settingsToAdkModel,
} from "./types";

// ── Tool adapters ───────────────────────────────────────────────────
export { ADK_BUILTIN_TOOLS } from "./tools";

// ── Agent definitions ───────────────────────────────────────────────
export {
  createAdkAgent,
  adkChatAgent,
  adkPlanAgent,
  adkArchitectAgent,
  adkCoderAgent,
  adkTestAgent,
  adkSecureAgent,
  adkDeployAgent,
  adkMonitorAgent,
  ADK_ALL_AGENTS,
  ADK_AGENT_LIST,
} from "./agents";
export type { AgentOptions } from "./agents";

// ── Root agent ──────────────────────────────────────────────────────
export { createAdkRunnerRootAgent } from "./rootAgent";

// ── Runner ──────────────────────────────────────────────────────────
export { createAdkRunner, textContent } from "./runner";

// ── Sessions & state ────────────────────────────────────────────────
export { sessionService, artifactService, ADK_STATE_KEYS, agentStateKey } from "./sessions";

// ── Security plugins ────────────────────────────────────────────────
export {
  createNflowSecurityPlugin,
  createEmergencyStopCallback,
  createPridesPhaseCallback,
  createDriftDetectionCallback,
  triggerEmergencyStop,
  clearEmergencyStop,
  isEmergencyStopActive,
} from "./plugins";
