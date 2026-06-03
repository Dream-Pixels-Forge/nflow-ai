/**
 * Pre-built agent definitions using the new NexusAgent class
 * 
 * These agents are designed to work together as a development team.
 */

import { z } from 'zod';
import { NexusAgent, createAgent } from './NexusAgent';
import { Tool, createTool } from './Tool';
import { AgentMode } from '../../types';

// ============ Tools ============

export const readFileTool = createTool({
  name: 'read_file',
  description: 'Read contents of a file',
  parameters: z.object({
    path: z.string().describe('File path to read')
  }),
  category: 'file',
  execute: async ({ path }) => ({
    success: true,
    output: `[File content of ${path}]`
  })
});

export const writeFileTool = createTool({
  name: 'write_file',
  description: 'Write content to a file',
  parameters: z.object({
    path: z.string().describe('File path to write'),
    content: z.string().describe('Content to write')
  }),
  requiresApproval: true,
  category: 'file',
  execute: async ({ path, content }) => ({
    success: true,
    output: `Written ${content.length} bytes to ${path}`
  })
});

export const runTestsTool = createTool({
  name: 'run_tests',
  description: 'Run test suite',
  parameters: z.object({
    pattern: z.string().optional().describe('Test file pattern')
  }),
  category: 'code',
  execute: async ({ pattern }) => ({
    success: true,
    output: `Tests passed for pattern: ${pattern ?? '*'}`
  })
});

export const scanSecurityTool = createTool({
  name: 'scan_security',
  description: 'Scan code for security vulnerabilities',
  parameters: z.object({
    path: z.string().optional().describe('Path to scan')
  }),
  category: 'code',
  execute: async ({ path }) => ({
    success: true,
    output: `Security scan complete for ${path ?? '.'}. No critical issues found.`
  })
});

export const deployTool = createTool({
  name: 'deploy',
  description: 'Deploy application',
  parameters: z.object({
    target: z.enum(['staging', 'production']).describe('Deployment target'),
    version: z.string().optional().describe('Version to deploy')
  }),
  requiresApproval: true,
  category: 'system',
  execute: async ({ target, version }) => ({
    success: true,
    output: `Deployed ${version ?? 'latest'} to ${target}`
  })
});

export const checkMetricsTool = createTool({
  name: 'check_metrics',
  description: 'Check system metrics and performance',
  parameters: z.object({
    service: z.string().optional().describe('Service name')
  }),
  category: 'system',
  execute: async ({ service }) => ({
    success: true,
    output: `Metrics for ${service ?? 'all services'}: OK`
  })
});

// ============ Agents ============

export const chatAgent = createAgent({
  id: AgentMode.CHAT,
  name: 'NEXUS-CHAT',
  description: 'Project Manager & Orchestrator. Routes work to specialists.',
  instruction: `You are NEXUS-CHAT, the project's orchestrator and coordinator.

Your role:
- Understand user requirements
- Route technical work to specialist agents
- Provide project status updates
- Coordinate between agents

When the user asks for code, implementation, or technical work:
1. Acknowledge the request
2. Explain which agent should handle it
3. Append the switch tag: [[SWITCH_TO:CODER]]

Available agents for routing:
- PLAN: Requirements and user stories
- ARCHITECT: System design and structure
- CODER: Code implementation
- TEST: QA and validation
- SECURE: Security analysis
- DEPLOY: CI/CD and deployment
- MONITOR: Performance and health`,
  temperature: 0.7
});

export const planAgent = createAgent({
  id: AgentMode.PLAN,
  name: 'NEXUS-PLAN',
  description: 'Requirements, user stories, and project roadmaps.',
  instruction: `You are NEXUS-PLAN, the requirements specialist.

Your role:
- Create detailed user stories
- Define acceptance criteria
- Build project roadmaps
- Break down complex tasks

Output format:
Use markdown checklists for tasks:
- [ ] Task 1
- [ ] Task 2

Include acceptance criteria for each story.`,
  temperature: 0.5
});

export const architectAgent = createAgent({
  id: AgentMode.ARCHITECT,
  name: 'NEXUS-ARCH',
  description: 'System design, architecture patterns, and structure.',
  instruction: `You are NEXUS-ARCH, the system architect.

Your role:
- Design system architecture
- Define file structure
- Identify scalability patterns
- Create data flow diagrams

Use ASCII diagrams or Mermaid charts for visual designs.
Use FILE: format to scaffold initial files.`,
  tools: [readFileTool, writeFileTool],
  temperature: 0.6
});

export const coderAgent = createAgent({
  id: AgentMode.CODER,
  name: 'NEXUS-CODE',
  description: 'Code implementation and technical development.',
  instruction: `You are NEXUS-CODE, the implementation specialist.

Your role:
- Write clean, efficient TypeScript/React code
- Implement features according to specs
- Follow best practices and patterns
- Generate production-ready code

When generating code, use this format:
FILE: path/to/file.ts
\`\`\`typescript
// code here
\`\`\`

Focus on:
- Type safety
- Error handling
- Performance
- Maintainability`,
  tools: [readFileTool, writeFileTool],
  temperature: 0.7
});

export const testAgent = createAgent({
  id: AgentMode.TEST,
  name: 'NEXUS-TEST',
  description: 'QA, testing, and validation.',
  instruction: `You are NEXUS-TEST, the quality assurance specialist.

Your role:
- Write comprehensive tests
- Identify edge cases
- Validate functionality
- Ensure coverage

Test types:
- Unit tests
- Integration tests
- Edge case tests

Use FILE: format for test files.`,
  tools: [readFileTool, writeFileTool, runTestsTool],
  temperature: 0.5
});

export const secureAgent = createAgent({
  id: AgentMode.SECURE,
  name: 'NEXUS-SEC',
  description: 'Security analysis and vulnerability assessment.',
  instruction: `You are NEXUS-SEC, the security specialist.

Your role:
- Analyze for vulnerabilities (OWASP Top 10)
- Suggest security hardening
- Review authentication flows
- Identify potential risks

Be paranoid and critical. Always assume the worst case.`,
  tools: [readFileTool, scanSecurityTool],
  temperature: 0.4
});

export const deployAgent = createAgent({
  id: AgentMode.DEPLOY,
  name: 'NEXUS-OPS',
  description: 'CI/CD, deployment, and DevOps.',
  instruction: `You are NEXUS-OPS, the deployment specialist.

Your role:
- Generate Dockerfiles
- Create GitHub Actions workflows
- Configure cloud infrastructure
- Manage deployment pipelines

Use FILE: format for configuration files.`,
  tools: [readFileTool, writeFileTool, deployTool],
  temperature: 0.6
});

export const monitorAgent = createAgent({
  id: AgentMode.MONITOR,
  name: 'NEXUS-MON',
  description: 'Performance monitoring and health checks.',
  instruction: `You are NEXUS-MON, the monitoring specialist.

Your role:
- Monitor system performance
- Identify bottlenecks
- Suggest optimizations
- Track health metrics

Act like a Site Reliability Engineer.`,
  tools: [checkMetricsTool],
  temperature: 0.5
});

// ============ Agent Teams ============

/**
 * Create a complete development team
 */
export function createDevTeam(): NexusAgent {
  return createAgent({
    id: AgentMode.CHAT,
    name: 'NEXUS-TEAM',
    description: 'Complete development team with all specialists',
    instruction: `You are the NEXUS development team coordinator.

You have access to specialist agents:
- PLAN: Requirements and roadmaps
- ARCHITECT: System design
- CODER: Implementation
- TEST: Quality assurance
- SECURE: Security analysis
- DEPLOY: DevOps
- MONITOR: Performance

Route work to the appropriate specialist.`,
    subAgents: [
      planAgent,
      architectAgent,
      coderAgent,
      testAgent,
      secureAgent,
      deployAgent,
      monitorAgent
    ]
  });
}

// ============ Exports ============

export const ALL_AGENTS: Record<AgentMode, NexusAgent> = {
  [AgentMode.CHAT]: chatAgent,
  [AgentMode.PLAN]: planAgent,
  [AgentMode.ARCHITECT]: architectAgent,
  [AgentMode.CODER]: coderAgent,
  [AgentMode.TEST]: testAgent,
  [AgentMode.SECURE]: secureAgent,
  [AgentMode.DEPLOY]: deployAgent,
  [AgentMode.MONITOR]: monitorAgent
};

export const ALL_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  runTestsTool,
  scanSecurityTool,
  deployTool,
  checkMetricsTool
];
