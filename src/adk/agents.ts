/**
 * ADK Agent Adapter
 *
 * Converts nflow-ai agent definitions to ADK LlmAgent instances.
 * Tools are imported directly from agents.ts (which creates FunctionTool instances).
 *
 * ADK LlmAgent does NOT have direct temperature / maxIterations fields.
 * Use generateContentConfig for generation parameters.
 */

import { LlmAgent } from "@google/adk";
import type { GenerateContentConfig } from "@google/genai";
import type { AgentMode } from "../../types";

import {
  readFileTool,
  writeFileTool,
  runTestsTool,
  scanSecurityTool,
  deployTool,
  checkMetricsTool,
} from "../agents/agents";

const ADK_BUILTIN_TOOLS = [
  readFileTool,
  writeFileTool,
  runTestsTool,
  scanSecurityTool,
  deployTool,
  checkMetricsTool,
];

// ── LlmAgent factory ─────────────────────────────────────────────────

export interface AgentOptions {
  mode: AgentMode;
  name: string;
  description: string;
  instruction: string;
  tools?: LlmAgent["tools"];
  subAgents?: LlmAgent[];
  model?: string;
  temperature?: number;
}

/**
 * Create an ADK LlmAgent from nflow-ai agent options.
 * Replaces `createAgent()` in `NexusAgent.ts`.
 */
export function createAdkAgent(options: AgentOptions): LlmAgent {
  const {
    mode,
    name,
    description,
    instruction,
    tools = [],
    subAgents = [],
    model,
    temperature,
  } = options;

  const config: ConstructorParameters<typeof LlmAgent>[0] = {
    name,
    description,
    instruction: buildSystemInstruction(instruction, mode, subAgents),
    tools,
    subAgents: subAgents.length > 0 ? subAgents : undefined,
    model,
  };

  if (temperature !== undefined) {
    config.generateContentConfig = { temperature } satisfies GenerateContentConfig;
  }

  return new LlmAgent(config);
}

function buildSystemInstruction(
  instruction: string,
  mode: AgentMode,
  subAgents: LlmAgent[],
): string {
  const parts = [instruction, "", `Agent: NEXUS-${mode}`];
  if (subAgents.length > 0) {
    parts.push(
      "",
      "Available specialist agents (use transfer to delegate):",
    );
    for (const sub of subAgents) {
      parts.push(`- ${sub.name}: ${sub.description}`);
    }
  }
  return parts.join("\n");
}

// ── Pre-built agents ─────────────────────────────────────────────────

function agentInstruction(
  role: string,
  details: string,
  routing?: string,
): string {
  let inst = `You are NEXUS-${role}, the ${role.toLowerCase()} specialist.\n\nYour role:\n${details}`;
  if (routing) {
    inst += `\n\n${routing}`;
  }
  return inst;
}

export const adkChatAgent = createAdkAgent({
  mode: "CHAT" as AgentMode,
  name: "NEXUS-CHAT",
  description: "Project Manager & Orchestrator. Routes work to specialists.",
  instruction: agentInstruction(
    "CHAT",
    "- Understand user requirements\n- Route technical work to specialist agents\n- Provide project status updates\n- Coordinate between agents",
    "When the user asks for code, implementation, or technical work:\n1. Acknowledge the request\n2. Explain which agent should handle it\n3. Use agent transfer to delegate to the appropriate specialist.",
  ),
  temperature: 0.7,
});

export const adkPlanAgent = createAdkAgent({
  mode: "PLAN" as AgentMode,
  name: "NEXUS-PLAN",
  description: "Requirements, user stories, and project roadmaps.",
  instruction: agentInstruction(
    "PLAN",
    "- Create detailed user stories\n- Define acceptance criteria\n- Build project roadmaps\n- Break down complex tasks\n\nOutput format:\nUse markdown checklists for tasks:\n- [ ] Task 1\n- [ ] Task 2\n\nInclude acceptance criteria for each story.",
  ),
  temperature: 0.5,
});

export const adkArchitectAgent = createAdkAgent({
  mode: "ARCHITECT" as AgentMode,
  name: "NEXUS-ARCH",
  description: "System design, architecture patterns, and structure.",
  instruction: agentInstruction(
    "ARCHITECT",
    "- Design system architecture\n- Define file structure\n- Identify scalability patterns\n- Create data flow diagrams\n\nUse ASCII diagrams or Mermaid charts for visual designs.",
  ),
  tools: [ADK_BUILTIN_TOOLS[0], ADK_BUILTIN_TOOLS[1]],
  temperature: 0.6,
});

export const adkCoderAgent = createAdkAgent({
  mode: "CODER" as AgentMode,
  name: "NEXUS-CODE",
  description: "Code implementation and technical development.",
  instruction: agentInstruction(
    "CODER",
    "- Write clean, efficient TypeScript/React code\n- Implement features according to specs\n- Follow best practices and patterns\n- Generate production-ready code\n\nFocus on:\n- Type safety\n- Error handling\n- Performance\n- Maintainability",
  ),
  tools: [ADK_BUILTIN_TOOLS[0], ADK_BUILTIN_TOOLS[1]],
  temperature: 0.7,
});

export const adkTestAgent = createAdkAgent({
  mode: "TEST" as AgentMode,
  name: "NEXUS-TEST",
  description: "QA, testing, and validation.",
  instruction: agentInstruction(
    "TEST",
    "- Write comprehensive tests\n- Identify edge cases\n- Validate functionality\n- Ensure coverage\n\nTest types:\n- Unit tests\n- Integration tests\n- Edge case tests",
  ),
  tools: [ADK_BUILTIN_TOOLS[0], ADK_BUILTIN_TOOLS[1], ADK_BUILTIN_TOOLS[2]],
  temperature: 0.5,
});

export const adkSecureAgent = createAdkAgent({
  mode: "SECURE" as AgentMode,
  name: "NEXUS-SEC",
  description: "Security analysis and vulnerability assessment.",
  instruction: agentInstruction(
    "SECURE",
    "- Analyze for vulnerabilities (OWASP Top 10)\n- Suggest security hardening\n- Review authentication flows\n- Identify potential risks\n\nBe paranoid and critical. Always assume the worst case.",
  ),
  tools: [ADK_BUILTIN_TOOLS[0], ADK_BUILTIN_TOOLS[3]],
  temperature: 0.4,
});

export const adkDeployAgent = createAdkAgent({
  mode: "DEPLOY" as AgentMode,
  name: "NEXUS-OPS",
  description: "CI/CD, deployment, and DevOps.",
  instruction: agentInstruction(
    "OPS",
    "- Generate Dockerfiles\n- Create GitHub Actions workflows\n- Configure cloud infrastructure\n- Manage deployment pipelines",
  ),
  tools: [ADK_BUILTIN_TOOLS[0], ADK_BUILTIN_TOOLS[1], ADK_BUILTIN_TOOLS[4]],
  temperature: 0.6,
});

export const adkMonitorAgent = createAdkAgent({
  mode: "MONITOR" as AgentMode,
  name: "NEXUS-MON",
  description: "Performance monitoring and health checks.",
  instruction: agentInstruction(
    "MONITOR",
    "- Monitor system performance\n- Identify bottlenecks\n- Suggest optimizations\n- Track health metrics\n\nAct like a Site Reliability Engineer.",
  ),
  tools: [ADK_BUILTIN_TOOLS[5]],
  temperature: 0.5,
});

// ── Agent registry ───────────────────────────────────────────────────

export const ADK_ALL_AGENTS: Record<string, LlmAgent> = {
  CHAT: adkChatAgent,
  PLAN: adkPlanAgent,
  ARCHITECT: adkArchitectAgent,
  CODER: adkCoderAgent,
  TEST: adkTestAgent,
  SECURE: adkSecureAgent,
  DEPLOY: adkDeployAgent,
  MONITOR: adkMonitorAgent,
};

export const ADK_AGENT_LIST: LlmAgent[] = Object.values(ADK_ALL_AGENTS);
