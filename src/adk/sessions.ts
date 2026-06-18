/**
 * ADK Session & State Adapter
 *
 * Configures ADK session services and bridges nflow-ai's custom
 * session/persistence layer with ADK's built-in services.
 */

import { InMemorySessionService, InMemoryArtifactService } from "@google/adk";

// ── Singleton services (shared across the app) ───────────────────────

/**
 * Global ADK session service instance.
 * Replace with DatabaseSessionService when persistence is needed.
 */
export const sessionService = new InMemorySessionService();

/**
 * Global ADK artifact service.
 * Replace with FileArtifactService when file-backed persistence is needed.
 */
export const artifactService = new InMemoryArtifactService();

// ── State key migration ──────────────────────────────────────────────

/**
 * nflow-ai custom StateKeys → ADK State key mapping.
 *
 * ADK's `State` type uses string keys scoped by agent name.
 * These constants provide bridge keys so existing state-dependent
 * code paths (PRIDES phase, tool history, etc.) continue working
 * after the ADK migration.
 */
export const ADK_STATE_KEYS = {
  PRIDES_PHASE: "prides_current_phase",
  TOOL_HISTORY: "tool_execution_history",
  CURRENT_AGENT: "current_agent_mode",
  SESSION_STARTED_AT: "session_started_at",
  LAST_TOOL_RESULT: "last_tool_result",
  ERROR_COUNT: "error_count",
  CIRCUIT_BREAKER: "circuit_breaker_open",
  EMERGENCY_STOP: "emergency_stop_triggered",
  BEHAVIORAL_DRIFT: "behavioral_drift_score",
  HEARTBEAT: "last_heartbeat_timestamp",
  A2A_PEERS: "a2a_connected_peers",
  MCP_CONNECTIONS: "mcp_active_connections",
} as const;

/**
 * Prefix for agent-scoped state keys.
 * ADK recommends prefixing state keys with the agent name.
 */
export function agentStateKey(agentName: string, key: string): string {
  return `${agentName}_${key}`;
}
