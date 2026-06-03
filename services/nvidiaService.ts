
import { AgentMode, Message, ToolState, Task, SuggestionLevel, ChatMode } from "../types";
import { getSystemInstruction } from "./promptUtils";

export interface NVIDIAConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface NVIDIAMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NVIDIAResponse {
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

export const DEFAULT_NVIDIA_CONFIG: NVIDIAConfig = {
  apiKey: '',
  model: 'meta/llama-3.1-405b-instruct',
  baseUrl: 'https://integrate.api.nvidia.com/v1'
};

// Popular models available on NVIDIA NIM
export const NVIDIA_MODELS = [
  { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta' },
  { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta' },
  { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'Meta' },
  { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B', provider: 'Mistral' },
  { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B', provider: 'Mistral' },
  { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'Google' },
  { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini', provider: 'Microsoft' },
  { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B', provider: 'NVIDIA' },
  { id: 'snowflake/arctic', name: 'Arctic', provider: 'Snowflake' },
  { id: 'databricks/dbrx-instruct', name: 'DBRX Instruct', provider: 'Databricks' }
];

export const sendMessageToNVIDIA = async (
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  suggestionLevel: SuggestionLevel = 'medium',
  config: NVIDIAConfig = DEFAULT_NVIDIA_CONFIG,
  chatMode: ChatMode = 'agent'
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
    const systemMsg: NVIDIAMessage = {
      role: 'system',
      content: getSystemInstruction(agent, projectSummary, currentTasks, suggestionLevel, chatMode)
    };

    const recentHistory: NVIDIAMessage[] = history
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .slice(-15)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

    const userMsg: NVIDIAMessage = {
      role: 'user',
      content: contextInjection ? `${contextInjection}\n\nUSER REQUEST: ${prompt}` : prompt
    };

    const messages = [systemMsg, ...recentHistory, userMsg];

    // Call NVIDIA API
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
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
      throw new Error(`NVIDIA API Error: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const data: NVIDIAResponse = await response.json();
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
    console.error("NVIDIA Service Error:", error);
    return {
      text: `[NVIDIA ERROR]: ${error.message || "Failed to connect to NVIDIA NIM API."}\n\nTip: Get your API key from https://build.nvidia.com/`
    };
  }
};

export const getNVIDIAModels = async (apiKey: string): Promise<string[]> => {
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data?.map((m: any) => m.id) || NVIDIA_MODELS.map(m => m.id);
  } catch (error) {
    console.warn("Failed to fetch NVIDIA models:", error);
    return NVIDIA_MODELS.map(m => m.id);
  }
};
