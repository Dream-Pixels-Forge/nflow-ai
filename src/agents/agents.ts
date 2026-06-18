/**
 * Pre-built agent definitions using ADK LlmAgent
 *
 * These agents are designed to work together as a development team.
 * Replaces the old NexusAgent-based implementation.
 */

import { z } from 'zod';
import { LlmAgent, FunctionTool } from "@google/adk";
import type { GenerateContentConfig } from "@google/genai";
import { AgentMode } from '../../types';

// ============ Tools ============

export const readFileTool = new FunctionTool({
  name: 'read_file',
  description: 'Read contents of a file',
  parameters: z.object({ path: z.string().describe('File path to read') }),
  execute: async ({ path }) => ({ success: true, output: `[File content of ${path}]` }),
});

export const writeFileTool = new FunctionTool({
  name: 'write_file',
  description: 'Write content to a file',
  parameters: z.object({
    path: z.string().describe('File path to write'),
    content: z.string().describe('Content to write'),
  }),
  execute: async ({ path, content }) => ({
    success: true,
    output: `Written ${content.length} bytes to ${path}`,
  }),
});

export const runTestsTool = new FunctionTool({
  name: 'run_tests',
  description: 'Run test suite',
  parameters: z.object({ pattern: z.string().optional().describe('Test file pattern') }),
  execute: async ({ pattern }) => ({
    success: true,
    output: `Tests passed for pattern: ${pattern ?? '*'}`
  }),
});

export const scanSecurityTool = new FunctionTool({
  name: 'scan_security',
  description: 'Scan code for security vulnerabilities',
  parameters: z.object({ path: z.string().optional().describe('Path to scan') }),
  execute: async ({ path }) => ({
    success: true,
    output: `Security scan complete for ${path ?? '.'}. No critical issues found.`,
  }),
});

export const deployTool = new FunctionTool({
  name: 'deploy',
  description: 'Deploy application',
  parameters: z.object({
    target: z.enum(['staging', 'production']).describe('Deployment target'),
    version: z.string().optional().describe('Version to deploy'),
  }),
  execute: async ({ target, version }) => ({
    success: true,
    output: `Deployed ${version ?? 'latest'} to ${target}`,
  }),
});

export const checkMetricsTool = new FunctionTool({
  name: 'check_metrics',
  description: 'Check system metrics and performance',
  parameters: z.object({ service: z.string().optional().describe('Service name') }),
  execute: async ({ service }) => ({
    success: true,
    output: `Metrics for ${service ?? 'all services'}: OK`,
  }),
});

// ============ Helpers ============

function newAgent(
  name: string,
  description: string,
  instruction: string,
  options?: { tools?: FunctionTool[]; temperature?: number },
): LlmAgent {
  const config: ConstructorParameters<typeof LlmAgent>[0] = {
    name, description, instruction,
    tools: options?.tools,
    ...(options?.temperature !== undefined ? {
      generateContentConfig: { temperature: options.temperature },
    } : {}),
  };
  return new LlmAgent(config);
}

// ============ Agents ============

export const chatAgent = newAgent(
  'NEXUS-CHAT',
  'Project Manager & Orchestrator. Routes work to specialists.',
  [
    "You are NEXUS-CHAT, the project's orchestrator and coordinator.",
    '',
    'Your role:',
    '- Understand user requirements',
    '- Route technical work to specialist agents',
    '- Provide project status updates',
    '- Coordinate between agents',
    '',
    'When the user asks for code, implementation, or technical work:',
    '1. Acknowledge the request',
    '2. Explain which agent should handle it',
    '3. Use agent transfer to delegate to the appropriate specialist.',
    '',
    'Available agents for routing:',
    '- PLAN: Requirements and user stories',
    '- ARCHITECT: System design and structure',
    '- CODER: Code implementation',
    '- TEST: QA and validation',
    '- SECURE: Security analysis',
    '- DEPLOY: CI/CD and deployment',
    '- MONITOR: Performance and health',
  ].join('\n'),
  { temperature: 0.7 },
);

export const planAgent = newAgent(
  'NEXUS-PLAN',
  'Requirements, user stories, and project roadmaps.',
  [
    "You are NEXUS-PLAN, the requirements specialist.",
    '',
    'Your role:',
    '- Create detailed user stories',
    '- Define acceptance criteria',
    '- Build project roadmaps',
    '- Break down complex tasks',
    '',
    'Output format: Use markdown checklists.',
    'Include acceptance criteria for each story.',
  ].join('\n'),
  { temperature: 0.5 },
);

export const architectAgent = newAgent(
  'NEXUS-ARCH',
  'System design, architecture patterns, and structure.',
  [
    "You are NEXUS-ARCH, the system architect.",
    '',
    'Your role:',
    '- Design system architecture',
    '- Define file structure',
    '- Identify scalability patterns',
    '- Create data flow diagrams',
    '',
    'Use ASCII diagrams or Mermaid charts for visual designs.',
  ].join('\n'),
  { tools: [readFileTool, writeFileTool], temperature: 0.6 },
);

export const coderAgent = newAgent(
  'NEXUS-CODE',
  'Code implementation and technical development.',
  [
    "You are NEXUS-CODE, the implementation specialist.",
    '',
    'Your role:',
    '- Write clean, efficient TypeScript/React code',
    '- Implement features according to specs',
    '- Follow best practices and patterns',
    '- Generate production-ready code',
    '',
    'Focus on: Type safety, Error handling, Performance, Maintainability',
  ].join('\n'),
  { tools: [readFileTool, writeFileTool], temperature: 0.7 },
);

export const testAgent = newAgent(
  'NEXUS-TEST',
  'QA, testing, and validation.',
  [
    "You are NEXUS-TEST, the quality assurance specialist.",
    '',
    'Your role:',
    '- Write comprehensive tests',
    '- Identify edge cases',
    '- Validate functionality',
    '- Ensure coverage',
    '',
    'Test types: Unit tests, Integration tests, Edge case tests.',
  ].join('\n'),
  { tools: [readFileTool, writeFileTool, runTestsTool], temperature: 0.5 },
);

export const secureAgent = newAgent(
  'NEXUS-SEC',
  'Security analysis and vulnerability assessment.',
  [
    "You are NEXUS-SEC, the security specialist.",
    '',
    'Your role:',
    '- Analyze for vulnerabilities (OWASP Top 10)',
    '- Suggest security hardening',
    '- Review authentication flows',
    '- Identify potential risks',
    '',
    'Be paranoid and critical. Always assume the worst case.',
  ].join('\n'),
  { tools: [readFileTool, scanSecurityTool], temperature: 0.4 },
);

export const deployAgent = newAgent(
  'NEXUS-OPS',
  'CI/CD, deployment, and DevOps.',
  [
    "You are NEXUS-OPS, the deployment specialist.",
    '',
    'Your role:',
    '- Generate Dockerfiles',
    '- Create GitHub Actions workflows',
    '- Configure cloud infrastructure',
    '- Manage deployment pipelines',
  ].join('\n'),
  { tools: [readFileTool, writeFileTool, deployTool], temperature: 0.6 },
);

export const monitorAgent = newAgent(
  'NEXUS-MON',
  'Performance monitoring and health checks.',
  [
    "You are NEXUS-MON, the monitoring specialist.",
    '',
    'Your role:',
    '- Monitor system performance',
    '- Identify bottlenecks',
    '- Suggest optimizations',
    '- Track health metrics',
    '',
    'Act like a Site Reliability Engineer.',
  ].join('\n'),
  { tools: [checkMetricsTool], temperature: 0.5 },
);

// ============ Agent Team ============

function freshAgent(
  name: string,
  description: string,
  instruction: string,
): LlmAgent {
  return new LlmAgent({ name, description, instruction });
}

export function createDevTeam(): LlmAgent {
  // Fresh agents to avoid ADK single-parent constraint on shared singletons
  const plan = freshAgent('NEXUS-PLAN', 'Requirements and roadmaps.',
    'You are NEXUS-PLAN, the requirements specialist. Create user stories, acceptance criteria, and roadmaps.');
  const arch = freshAgent('NEXUS-ARCH', 'System design and architecture.',
    'You are NEXUS-ARCH, the system architect. Design architecture, define structure, use diagrams.');
  const code = freshAgent('NEXUS-CODE', 'Code implementation.',
    'You are NEXUS-CODE, the implementation specialist. Write clean TypeScript/React code.');
  const test = freshAgent('NEXUS-TEST', 'QA and validation.',
    'You are NEXUS-TEST, the QA specialist. Write tests, find edge cases, ensure coverage.');
  const sec = freshAgent('NEXUS-SEC', 'Security analysis.',
    'You are NEXUS-SEC, the security specialist. Find vulnerabilities (OWASP Top 10). Be paranoid.');
  const dep = freshAgent('NEXUS-OPS', 'CI/CD and deployment.',
    'You are NEXUS-OPS, the deployment specialist. Create Dockerfiles, CI/CD, cloud config.');
  const mon = freshAgent('NEXUS-MON', 'Performance monitoring.',
    'You are NEXUS-MON, the monitoring specialist. Track metrics, identify bottlenecks.');

  return new LlmAgent({
    name: 'NEXUS-TEAM',
    description: 'Complete development team with all specialists',
    instruction: [
      'You are the NEXUS development team coordinator.',
      '',
      'You have access to specialist agents.',
      'Route work to the appropriate specialist.',
      '',
      '- PLAN: Requirements and roadmaps',
      '- ARCHITECT: System design',
      '- CODER: Implementation',
      '- TEST: Quality assurance',
      '- SECURE: Security analysis',
      '- DEPLOY: DevOps',
      '- MONITOR: Performance',
    ].join('\n'),
    subAgents: [plan, arch, code, test, sec, dep, mon],
  });
}

// ============ Registry ============

export const ALL_AGENTS: Record<AgentMode, LlmAgent> = {
  [AgentMode.CHAT]: chatAgent,
  [AgentMode.PLAN]: planAgent,
  [AgentMode.ARCHITECT]: architectAgent,
  [AgentMode.CODER]: coderAgent,
  [AgentMode.TEST]: testAgent,
  [AgentMode.SECURE]: secureAgent,
  [AgentMode.DEPLOY]: deployAgent,
  [AgentMode.MONITOR]: monitorAgent,
};

export const ALL_TOOLS: FunctionTool[] = [
  readFileTool,
  writeFileTool,
  runTestsTool,
  scanSecurityTool,
  deployTool,
  checkMetricsTool,
];
