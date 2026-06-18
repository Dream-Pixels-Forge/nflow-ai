/**
 * ADK Type Mappings
 *
 * Bridges nflow-ai's native types with @google/adk types.
 * These are thin re-exports and adapter functions — no custom logic.
 */

import type {
  Event,
  EventType,
  LlmAgent as AdkLlmAgent,
  FunctionTool as AdkFunctionTool,
  BaseSessionService,
  BaseMemoryService,
  BaseArtifactService,
  State,
  mergeStates,
  RunConfig,
} from "@google/adk";

// ── Re-export ADK types we use externally ────────────────────────────

export type {
  Event,
  EventType,
  RunConfig,
  State,
  BaseSessionService,
  BaseMemoryService,
  BaseArtifactService,
};

// ADK class references (not type-only)
export {
  LlmAgent,
  FunctionTool,
  InMemorySessionService,
  InMemoryMemoryService,
  InMemoryArtifactService,
  SequentialAgent,
  LoopAgent,
  ParallelAgent,
  Runner,
  SessionStateCredentialService,
} from "@google/adk";

// ── nflow-ai → ADK type bridges ──────────────────────────────────────

import type { AgentMode, Message, ToolState, AppSettings } from "../../types";

/**
 * Map nflow-ai AgentMode to a string that ADK LlmAgent.name accepts.
 */
export function agentModeToName(mode: AgentMode): string {
  return `NEXUS-${mode}`;
}

/**
 * Map an nflow-ai AgentMode enum to a role description for system prompt.
 */
export function agentModeToDescription(mode: AgentMode): string {
  const descriptions: Record<string, string> = {
    CHAT: "Project Manager & Orchestrator. Routes work to specialists.",
    PLAN: "Requirements, user stories, and project roadmaps.",
    ARCHITECT: "System design, architecture patterns, and structure.",
    CODER: "Code implementation and technical development.",
    TEST: "QA, testing, and validation.",
    SECURE: "Security analysis and vulnerability assessment.",
    DEPLOY: "CI/CD, deployment, and DevOps.",
    MONITOR: "Performance monitoring and health checks.",
  };
  return descriptions[mode] ?? "General agent";
}

/**
 * Convert a list of nflow-ai Messages into ADK content parts.
 * ADK Runner.sendMessage expects Content objects with role + parts.
 */
export function messagesToContent(
  history: Message[],
): Array<{ role: string; parts: Array<{ text: string }> }> {
  return history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-50)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

/**
 * Convert nflow-ai ToolState into ADK-compatible context injection string.
 */
export function toolStateToContext(
  tools: ToolState,
  prompt: string,
): string {
  const parts: string[] = [];

  if (tools.rag.active && tools.rag.content.length > 0) {
    parts.push(
      `\n\n[SYSTEM: RAG CONTEXT LOADED]\n${tools.rag.content.join("\n---\n")}`,
    );
  }

  if (tools.mcp.active) {
    parts.push(
      `\n\n[SYSTEM: MCP BRIDGE ACTIVE]\nConnected to MCP server on port ${tools.mcp.port}.`,
    );
  }

  if (tools.fetch.active) {
    parts.push(
      `\n\n[SYSTEM: FETCH ACTIVE]\nWeb fetch available. Target: ${tools.fetch.targetUrl}`,
    );
  }

  return parts.join("");
}

/**
 * Derive ADK model string from AppSettings.
 * Returns undefined for non-Gemini providers (caller falls back to provider dispatch).
 */
export function settingsToAdkModel(
  settings: AppSettings,
  _agent?: AgentMode,
): string | undefined {
  if (settings.aiProvider !== "gemini") return undefined;

  // ADK's Gemini LLM regex is /gemini-.*/ — DO NOT add a provider prefix.
  const geminiModel =
    settings.geminiModel || "gemini-2.0-flash";
  // Strip any leading "gemini/" or "models/" prefix ADK doesn't accept
  const cleaned = geminiModel
    .replace(/^gemini\//, "")
    .replace(/^models\//, "");
  return cleaned;
}
