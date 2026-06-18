/**
 * ADK Root Agent
 *
 * Creates the root agent for the ADK Runner.
 * Uses fresh LlmAgent instances to avoid ADK's single-parent constraint
 * on sub-agents.
 */

import { LlmAgent, FunctionTool } from "@google/adk";
import type { GenerateContentConfig } from "@google/genai";

/**
 * Create a fresh set of specialist agents for the runner root.
 * These are NOT the same instances as the singletons in agents.ts,
 * avoiding ADK's single-parent-per-agent restriction.
 */
function createSpecialistAgent(
  name: string,
  description: string,
  instruction: string,
  tools?: FunctionTool[],
  temperature = 0.5,
  model?: string,
): LlmAgent {
  const config: ConstructorParameters<typeof LlmAgent>[0] = {
    name,
    description,
    instruction,
    tools,
    model,
  };
  if (temperature !== undefined) {
    config.generateContentConfig = { temperature } satisfies GenerateContentConfig;
  }
  return new LlmAgent(config);
}

export function createAdkRunnerRootAgent(model?: string): LlmAgent {
  const planAgent = createSpecialistAgent(
    "NEXUS-PLAN",
    "Requirements, user stories, and project roadmaps.",
    [
      "You are NEXUS-PLAN, the requirements specialist.",
      "",
      "Your role:",
      "- Create detailed user stories",
      "- Define acceptance criteria",
      "- Build project roadmaps",
      "- Break down complex tasks",
    ].join("\n"),
    undefined, /* tools */
    0.5,
    model,
  );

  const archAgent = createSpecialistAgent(
    "NEXUS-ARCH",
    "System design, architecture patterns, and structure.",
    [
      "You are NEXUS-ARCH, the architecture specialist.",
      "",
      "Your role:",
      "- Design system architecture",
      "- Evaluate technology choices",
      "- Create component diagrams",
      "- Review design decisions",
    ].join("\n"),
    undefined, /* tools */
    0.5,
    model,
  );

  const coderAgent = createSpecialistAgent(
    "NEXUS-CODE",
    "Code implementation and technical development.",
    [
      "You are NEXUS-CODE, the implementation specialist.",
      "",
      "Your role:",
      "- Write clean, efficient code",
      "- Follow project conventions",
      "- Implement features and fix bugs",
      "- Review code quality",
    ].join("\n"),
    undefined, /* tools */
    0.5,
    model,
  );

  const testAgent = createSpecialistAgent(
    "NEXUS-TEST",
    "QA, testing, and validation.",
    [
      "You are NEXUS-TEST, the quality assurance specialist.",
      "",
      "Your role:",
      "- Write unit and integration tests",
      "- Verify acceptance criteria",
      "- Report quality metrics",
      "- Identify edge cases",
    ].join("\n"),
    undefined, /* tools */
    0.5,
    model,
  );

  const secureAgent = createSpecialistAgent(
    "NEXUS-SEC",
    "Security analysis and vulnerability assessment.",
    [
      "You are NEXUS-SEC, the security specialist.",
      "",
      "Your role:",
      "- Identify security vulnerabilities",
      "- Recommend security improvements",
      "- Review code for OWASP Top 10 issues",
      "- Ensure compliance with security best practices",
    ].join("\n"),
    undefined, /* tools */
    0.5,
    model,
  );

  const deployAgent = createSpecialistAgent(
    "NEXUS-OPS",
    "CI/CD, deployment, and DevOps.",
    [
      "You are NEXUS-OPS, the deployment specialist.",
      "",
      "Your role:",
      "- Set up CI/CD pipelines",
      "- Manage deployments",
      "- Monitor build processes",
      "- Ensure reliable releases",
    ].join("\n"),
    undefined, /* tools */
    0.5,
    model,
  );

  const monitorAgent = createSpecialistAgent(
    "NEXUS-MON",
    "Performance monitoring and health checks.",
    [
      "You are NEXUS-MON, the monitoring specialist.",
      "",
      "Your role:",
      "- Monitor application performance",
      "- Set up alerting and dashboards",
      "- Analyze system health metrics",
      "- Troubleshoot production issues",
    ].join("\n"),
    undefined, /* tools */
    0.5,
    model,
  );

  return new LlmAgent({
    name: "NEXUS-ROOT",
    description: "Root coordinator agent for the NEXUS development team.",
    instruction: [
      "You are the NEXUS development team coordinator.",
      "",
      "You have access to specialist agents.",
      "Route work to the appropriate specialist using agent transfer.",
      "",
      "Available specialist agents:",
      "- NEXUS-PLAN: Requirements and roadmaps",
      "- NEXUS-ARCH: System design and architecture",
      "- NEXUS-CODE: Code implementation",
      "- NEXUS-TEST: Quality assurance",
      "- NEXUS-SEC: Security analysis",
      "- NEXUS-OPS: CI/CD and deployment",
      "- NEXUS-MON: Performance monitoring",
    ].join("\n"),
    model,
    subAgents: [
      planAgent,
      archAgent,
      coderAgent,
      testAgent,
      secureAgent,
      deployAgent,
      monitorAgent,
    ],
  });
}
