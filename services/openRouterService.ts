
import { AgentMode, Message, ToolState, Task, SuggestionLevel } from "../types";
import { getSystemInstruction } from "./promptUtils";

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
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

export const DEFAULT_OPENROUTER_CONFIG: OpenRouterConfig = {
  apiKey: '',
  model: 'anthropic/claude-3.5-sonnet',
  baseUrl: 'https://openrouter.ai/api/v1'
};

// Popular models available on OpenRouter
export const OPENROUTER_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google' },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta' },
  { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'Mistral' },
  { id: 'nousresearch/hermes-3-llama-3.1-405b', name: 'Hermes 3 405B', provider: 'NousResearch' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' }
];

export const sendMessageToOpenRouter = async (
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  suggestionLevel: SuggestionLevel = 'medium',
  config: OpenRouterConfig = DEFAULT_OPENROUTER_CONFIG
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
    const systemMsg: OpenRouterMessage = {
      role: 'system',
      content: getSystemInstruction(agent, projectSummary, currentTasks, suggestionLevel)
    };

    const recentHistory: OpenRouterMessage[] = history
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .slice(-15)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

    const userMsg: OpenRouterMessage = {
      role: 'user',
      content: contextInjection ? `${contextInjection}\n\nUSER REQUEST: ${prompt}` : prompt
    };

    const messages = [systemMsg, ...recentHistory, userMsg];

    // Call OpenRouter API
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
      throw new Error(`OpenRouter API Error: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();
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
    console.error("OpenRouter Service Error:", error);
    return {
      text: `[OPENROUTER ERROR]: ${error.message || "Failed to connect to OpenRouter API."}\n\nTip: Get your API key from https://openrouter.ai/keys`
    };
  }
};

export const getOpenRouterModels = async (apiKey: string): Promise<string[]> => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data?.map((m: any) => m.id) || OPENROUTER_MODELS.map(m => m.id);
  } catch (error) {
    console.warn("Failed to fetch OpenRouter models:", error);
    return OPENROUTER_MODELS.map(m => m.id);
  }
};
