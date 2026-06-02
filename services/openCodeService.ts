
import { AgentMode, Message, ToolState, Task, SuggestionLevel } from "../types";
import { getSystemInstruction } from "./promptUtils";

export interface OpenCodeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface OpenCodeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenCodeResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const DEFAULT_OPENCODE_CONFIG: OpenCodeConfig = {
  apiKey: '',
  baseUrl: 'https://api.opencode.ai/v1',
  model: 'opencode-1'
};

export const sendMessageToOpenCode = async (
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  suggestionLevel: SuggestionLevel = 'medium',
  config: OpenCodeConfig = DEFAULT_OPENCODE_CONFIG
): Promise<{ text: string; sources?: string[]; suggestedAgent?: AgentMode }> => {
  
  try {
    // Construct Context from Tools
    let contextInjection = "";
    
    if (tools.rag.active && tools.rag.content.length > 0) {
      contextInjection += `\n\n[SYSTEM: RAG CONTEXT LOADED]\nThe following information is provided from the local knowledge base:\n${tools.rag.content.join('\n---\n')}\n`;
    }
    
    if (tools.mcp.active) {
      contextInjection += `\n\n[SYSTEM: MCP BRIDGE ACTIVE]\nConnected to local MCP server on port ${tools.mcp.port}.`;
    }

    if (tools.fetch.active) {
       contextInjection += `\n\n[SYSTEM: WEB FETCH]\nWeb search is enabled. URL target: ${tools.fetch.targetUrl || 'general'}`;
    }

    // Build messages array
    const systemMsg: OpenCodeMessage = {
      role: 'system',
      content: getSystemInstruction(agent, projectSummary, currentTasks, suggestionLevel)
    };

    const recentHistory: OpenCodeMessage[] = history
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .slice(-15)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

    const userMsg: OpenCodeMessage = {
      role: 'user',
      content: contextInjection ? `${contextInjection}\n\nUSER REQUEST: ${prompt}` : prompt
    };

    const messages = [systemMsg, ...recentHistory, userMsg];

    // Call OpenCode API
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'NexusFlow'
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenCode API Error: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const data: OpenCodeResponse = await response.json();
    let responseText = data.choices[0]?.message?.content || "No response generated.";

    // Extract Suggested Agent Switch
    let suggestedAgent: AgentMode | undefined;
    const switchRegex = /\[\[SWITCH_TO:(.*?)\]\]/;
    const switchMatch = responseText.match(switchRegex);
    if (switchMatch) {
      const agentId = switchMatch[1].trim() as AgentMode;
      const validAgents = Object.values(AgentMode);
      if (validAgents.includes(agentId)) {
        suggestedAgent = agentId;
      }
      responseText = responseText.replace(switchMatch[0], '').trim();
    }

    return {
      text: responseText,
      suggestedAgent
    };

  } catch (error: any) {
    console.error("OpenCode Service Error:", error);
    return {
      text: `[OPENCODE ERROR]: ${error.message || "Failed to connect to OpenCode API."}\n\nTip: Ensure your API key is configured correctly.`
    };
  }
};

export const getOpenCodeModels = async (config: OpenCodeConfig): Promise<string[]> => {
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': window.location.origin
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data?.map((m: any) => m.id) || ['opencode-1'];
  } catch (error) {
    console.warn("Failed to fetch OpenCode models:", error);
    return ['opencode-1'];
  }
};
