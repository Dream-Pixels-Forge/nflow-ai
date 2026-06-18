/**
 * ADK Runner Setup
 *
 * Creates and configures ADK Runner instances for Agent OS use.
 * The Runner replaces `PipelineOrchestrator` and `agentic/AgentOrchestrator`
 * as the central agent execution engine.
 *
 * ADK Runner takes a SINGLE root agent. Transfer between agents is
 * handled via ADK's built-in agent routing (sub-agents).
 */

import { Runner, LlmAgent, InMemorySessionService, InMemoryMemoryService } from "@google/adk";
import type { BasePlugin } from "@google/adk";
import type { Content } from "@google/genai";

import { createAdkRunnerRootAgent } from "./rootAgent";

/**
 * Create an ADK Runner for Agent OS.
 *
 * The runner is configured with:
 * - A root agent that can transfer to the 8 specialist agents
 * - In-memory session and memory services
 * - Optional security plugins
 */
export function createAdkRunner(options?: {
  sessionService?: InMemorySessionService;
  memoryService?: InMemoryMemoryService;
  plugins?: BasePlugin[];
  model?: string;
}): Runner {
  const sessionService = options?.sessionService ?? new InMemorySessionService();
  const memoryService = options?.memoryService ?? new InMemoryMemoryService();
  const plugins = options?.plugins ?? [];

  const rootAgent = createAdkRunnerRootAgent(options?.model);

  return new Runner({
    appName: "nflow-ai",
    agent: rootAgent,
    sessionService,
    memoryService,
    plugins,
  });
}

/**
 * Helper to build a single Content message for Runner.runAsync.
 */
export function textContent(text: string): Content {
  return {
    role: "user",
    parts: [{ text }],
  };
}
