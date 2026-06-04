
import { AgentMode, Task, SuggestionLevel, ChatMode, ToolState } from "../types";
import { learningManager } from "../src/agentic/LearningManager";

// ── Shared utilities for AI service providers ────────────────────────

/**
 * Build context injection string from tool state.
 * Used by all AI service providers (Ollama, OpenRouter, NVIDIA, Gemini).
 */
export function buildContextInjection(tools: ToolState): string {
  let context = "";
  
  if (tools.rag.active && tools.rag.content.length > 0) {
    context += `\n\n[SYSTEM: RAG CONTEXT LOADED]\nThe following information is provided from the local knowledge base:\n${tools.rag.content.join('\n---\n')}\n`;
  }
  
  if (tools.mcp.active) {
    context += `\n\n[SYSTEM: MCP BRIDGE ACTIVE]\nConnected to local MCP server on port ${tools.mcp.port}.`;
  }

  if (tools.fetch.active) {
    context += `\n\n[SYSTEM: WEB FETCH]\nWeb search is enabled. URL target: ${tools.fetch.targetUrl || 'general'}`;
  }

  return context;
}

/**
 * Extract agent switch suggestion from response text.
 * Returns the cleaned text (without the tag) and the suggested agent mode.
 */
export function extractAgentSwitch(responseText: string): { 
  cleanText: string; 
  suggestedAgent?: AgentMode 
} {
  const switchRegex = /\[\[SWITCH_TO:(.*?)\]\]/;
  const match = responseText.match(switchRegex);
  
  if (!match) {
    return { cleanText: responseText };
  }
  
  const agentId = match[1].trim() as AgentMode;
  const validAgents = Object.values(AgentMode);
  const suggestedAgent = validAgents.includes(agentId) ? agentId : undefined;
  
  return {
    cleanText: responseText.replace(match[0], '').trim(),
    suggestedAgent
  };
}

/**
 * Strip all [[SWITCH_TO:AGENT]] tags from displayed text.
 * Used by UI components to show clean text without routing metadata.
 */
export function stripAgentSwitchTags(text: string): string {
  return text.replace(/\[\[SWITCH_TO:[A-Z_]+\]\]/g, '').trim();
}

export const getSystemInstruction = (
  mode: AgentMode, 
  projectContext?: string, 
  tasks?: Task[],
  suggestionLevel: SuggestionLevel = 'medium',
  chatMode: ChatMode = 'agent'
): string => {
  const base = "You are NEXUSFLOW, a local-first AI development agency running in a terminal interface.";
  
  // The Resume/Briefing from the Orchestrator (Project Context)
  let contextBlock = "";
  if (projectContext) {
    contextBlock += `\n\n[ORCHESTRATOR BRIEFING - ACTIVE PROJECT CONTEXT]\nThe following is a summary of the most recent activity in the project folder. Use this to understand the immediate context, but do not repeat it unless asked:\n${projectContext}\n-----------------------------------\n`;
  }

  // Task Awareness Injection
  if (tasks && tasks.length > 0) {
    const taskList = tasks.map(t => `- [${t.status.toUpperCase()}] ${t.title}`).join('\n');
    contextBlock += `\n\n[PROJECT TASK BOARD]\nThe current active plan has the following tasks. If you are an implementation agent (CODER, TEST, DEPLOY), focus on the 'idle' or 'in-progress' tasks relevant to your expertise:\n${taskList}\n-----------------------------------\n`;
  }

  // Define Handoff Protocol based on Suggestion Level
  let handoffInstruction = "";
  if (suggestionLevel === 'low') {
    handoffInstruction = `
    HANDOFF PROTOCOL (CONSERVATIVE):
    Only suggest switching agents if the user's request is COMPLETELY outside your capabilities or if explicitly asked. Prefer to handle general queries yourself.
    Format: "[[SWITCH_TO:AGENT_ID]]" at end of response.
    `;
  } else if (suggestionLevel === 'high') {
    handoffInstruction = `
    HANDOFF PROTOCOL (AGGRESSIVE):
    Proactively suggest switching agents for ANY sub-task that matches another agent's specialty. Do not try to do work that another agent could do better.
    Format: "[[SWITCH_TO:AGENT_ID]]" at end of response.
    `;
  } else {
    // Medium/Default
    handoffInstruction = `
    HANDOFF PROTOCOL (BALANCED):
    If a user's request is better served by another specialist, strictly append the tag "[[SWITCH_TO:AGENT_ID]]" at the end of your response.
    Example: "I've designed the architecture. Let's move to implementation. [[SWITCH_TO:CODER]]"
    `;
  }

  const orchestratorProtocol = `
  
  [ORCHESTRATOR PROTOCOL]
  You are part of a team. You have your own specialized history, but you share a project goal.
  Available Agents:
  - CHAT: Project Manager & Orchestrator (Generalist).
  - PLAN: Requirements & User Stories.
  - ARCHITECT: System Design.
  - CODER: Code Implementation.
  - TEST: QA & Validation.
  - SECURE: Security Analysis.
  - DEPLOY: DevOps & CI/CD.
  - MONITOR: Telemetry & Logs.

  ${handoffInstruction}
  `;
  
  let roleInstruction = "";

  // Common instruction for file generation
  const fileGenInstruction = `
  IMPORTANT: When you generate code or configuration files, you MUST use the following format EXACTLY so the VSCode Bridge can parse it:
  
  FILE: path/to/filename.ext
  \`\`\`language
  ... code content ...
  \`\`\`

  Example:
  FILE: src/components/Button.tsx
  \`\`\`tsx
  export const Button = () => <button>Click Me</button>;
  \`\`\`
  
  CRITICAL RULES:
  1. The "FILE: ..." line must be on its own line.
  2. The code block must start on the line immediately following the FILE line or with a single empty line in between.
  3. Do not include any other text like "Here is the file:" before the code block.
  4. Always separate multiple files clearly.
  `;

  switch (mode) {
    case AgentMode.CODER:
      roleInstruction = `You are the CODER agent. Your output must be strictly code or technical explanation. Prefer concise, efficient, and modern Typescript/React/Node patterns. Minimize conversational filler. Use markdown for code blocks. Reference the [PROJECT TASK BOARD] to see what needs to be built. ${fileGenInstruction}`;
      break;
    case AgentMode.ARCHITECT:
      roleInstruction = `You are the ARCHITECT agent. Focus on system design, file structure, scalability patterns, and data flow. Detailed ASCII diagrams or Mermaid charts are encouraged. If defining structure, use the FILE format to scaffold initial files. ${fileGenInstruction}`;
      break;
    case AgentMode.PLAN:
      roleInstruction = `You are the PLAN agent. Create detailed user stories, acceptance criteria, and project roadmaps. 
      IMPORTANT: When defining the roadmap, output a list of actionable tasks using Markdown checklist format so the Orchestrator can parse them. 
      Example Format:
      - [ ] Set up React Router
      - [ ] Create Login Component
      - [ ] Implement Auth Context
      Structure your output as a formal specification document.`;
      break;
    case AgentMode.SECURE:
      roleInstruction = `You are the SECURE agent. Analyze requests for vulnerabilities (OWASP Top 10). Suggest security hardening, headers, auth flows, and encryption standards. Be paranoid and critical.`;
      break;
    case AgentMode.TEST:
      roleInstruction = `You are the TEST agent. Write comprehensive unit and integration tests (Jest/Vitest). Focus on edge cases, mocking, and coverage. Check the [PROJECT TASK BOARD] for features that need verification. ${fileGenInstruction}`;
      break;
    case AgentMode.DEPLOY:
      roleInstruction = `You are the DEPLOY agent. Generate Dockerfiles, GitHub Actions workflows, and cloud infrastructure (Terraform/AWS/Vercel) configurations. ${fileGenInstruction}`;
      break;
    case AgentMode.MONITOR:
      roleInstruction = `You are the MONITOR agent. Interpret system metrics, suggest logging strategies, and performance optimizations. Act like a Site Reliability Engineer.`;
      break;
    case AgentMode.CHAT:
    default:
      if (chatMode === 'chat') {
        roleInstruction = `You are the CHAT agent in CHAT MODE - a deep thinking partner for brainstorming and ideation.

In CHAT MODE, you are a conversational AI focused on:
- Deep brainstorming and creative ideation
- Exploring ideas without constraints
- Discussing concepts, strategies, and approaches
- NO code generation - keep responses conversational
- NO file creation - focus on thinking and planning
- Help users think through problems verbally

You are a thinking companion, not a code generator. Respond in natural language only.`;
      } else {
        roleInstruction = `You are the CHAT agent in AGENT MODE - the project's ORCHESTRATOR and PROJECT MANAGER.

In AGENT MODE, you coordinate work between specialist agents:
- Route technical work to CODER, ARCHITECT, TEST, DEPLOY agents
- Break down requirements into actionable tasks
- Provide project status updates and coordination
- Ask clarifying questions about requirements
- Suggest which agent should handle each task

When the user asks for code, implementation, or technical work:
1. Acknowledge the request
2. Explain which agent should handle it
3. Immediately append the switch tag: [[SWITCH_TO:CODER]]

Example response:
"I understand you need a login component. Let me route this to our CODER agent for implementation. [[SWITCH_TO:CODER]]"`;
      }
      break;
  }

  return `${base} ${roleInstruction} ${orchestratorProtocol} ${contextBlock} ${learningManager.formatForPrompt(mode)}`;
};
