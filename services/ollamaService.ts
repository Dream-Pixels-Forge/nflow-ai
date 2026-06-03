
import { AgentMode, Message, ToolState, Task, SuggestionLevel, ChatMode } from "../types";
import { getSystemInstruction } from "./promptUtils";

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export interface OllamaModelListResponse {
  models: {
    name: string;
    modified_at: string;
    size: number;
    digest: string;
    details: {
      format: string;
      family: string;
      families: string[];
      parameter_size: string;
      quantization_level: string;
    }
  }[];
}

export const getOllamaModels = async (baseUrl: string): Promise<string[]> => {
  try {
    // Ensure trailing slash is removed for the fetch
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const response = await fetch(`${cleanUrl}/api/tags`);
    
    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }
    
    const data: OllamaModelListResponse = await response.json();
    return data.models.map(m => m.name);
  } catch (error) {
    // Use warn instead of error to avoid alarming console noise for expected CORS/Connection issues
    console.warn("Ollama connection check failed (using fallbacks):", error);
    throw error; // Re-throw to let the UI handle the error state
  }
};

export const sendMessageToOllama = async (
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  suggestionLevel: SuggestionLevel = 'medium',
  baseUrl: string = 'http://localhost:11434',
  model: string = 'llama3',
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
       contextInjection += `\n\n[SYSTEM: WEB FETCH]\n(Note: Local models cannot browse the web directly, but simulated context is: URL target ${tools.fetch.targetUrl || 'general'})`;
    }

    // Build messages array for Ollama
    const systemMsg = {
      role: 'system',
      content: getSystemInstruction(agent, projectSummary, currentTasks, suggestionLevel, chatMode)
    };

    const recentHistory = history
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .slice(-15)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    const userMsg = {
        role: 'user',
        content: contextInjection ? `${contextInjection}\n\nUSER REQUEST: ${prompt}` : prompt
    };

    const messages = [systemMsg, ...recentHistory, userMsg];
    const cleanUrl = baseUrl.replace(/\/$/, '');

    // Call Ollama API with tool support
    const requestBody: Record<string, unknown> = {
      model: model,
      messages: messages,
      stream: false,
      options: {
          temperature: 0.7
      }
    };

    const response = await fetch(`${cleanUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.status} ${response.statusText}. Ensure Ollama is running and OLLAMA_ORIGINS="*" is set.`);
    }

    const data: OllamaResponse = await response.json();
    let responseText = data.message.content;

    // Extract Suggested Agent Switch
    let suggestedAgent: AgentMode | undefined;
    const switchRegex = /\[\[SWITCH_TO:(.*?)\]\]/;
    const switchMatch = responseText.match(switchRegex);
    if (switchMatch) {
      const agentId = switchMatch[1].trim() as AgentMode;
      // Validate
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

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to connect to Ollama.";
    console.error("Ollama Service Error:", error);
    return {
      text: `[LOCAL KERNEL ERROR]: ${message}\n\nTip: Make sure Ollama is running and run 'launchctl setenv OLLAMA_ORIGINS "*"' or equivalent to allow browser requests.`
    };
  }
};
// ── Streaming ──────────────────────────────────────────────────────

export interface OllamaStreamChunk {
  text: string;
  done: boolean;
  suggestedAgent?: AgentMode;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

export async function* sendMessageToOllamaStream(
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  suggestionLevel: SuggestionLevel = 'medium',
  baseUrl: string = 'http://localhost:11434',
  model: string = 'llama3',
  chatMode: ChatMode = 'agent'
): AsyncGenerator<OllamaStreamChunk> {
  let contextInjection = "";
  if (tools.rag.active && tools.rag.content.length > 0) {
    contextInjection += `\n\n[SYSTEM: RAG CONTEXT LOADED]\n${tools.rag.content.join('\n---\n')}\n`;
  }
  if (tools.mcp.active) {
    contextInjection += `\n\n[SYSTEM: MCP BRIDGE ACTIVE]\nConnected to local MCP server on port ${tools.mcp.port}.`;
  }

  const systemMsg = {
    role: 'system',
    content: getSystemInstruction(agent, projectSummary, currentTasks, suggestionLevel, chatMode)
  };

  const recentHistory = history
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .slice(-10)
    .map(msg => ({
      role: msg.role,
      content: msg.content
    }));

  const userMsg = {
    role: 'user',
    content: contextInjection ? `${contextInjection}\n\nUSER REQUEST: ${prompt}` : prompt
  };

  const messages = [systemMsg, ...recentHistory, userMsg];
  const cleanUrl = baseUrl.replace(/\/$/, '');

  const response = await fetch(`${cleanUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true,
      options: { temperature: 0.7 }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama API Error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed: unknown = JSON.parse(line);
          if (parsed !== null && typeof parsed === "object" && "message" in parsed) {
            const obj = parsed as Record<string, unknown>;
            const msg = obj.message as Record<string, unknown> | undefined;
            if (!msg) continue;

            if (typeof msg.content === "string") {
              yield { text: msg.content, done: false };
            }
            // Check for agent switch suggestion in content
            if (typeof msg.content === "string") {
              const switchMatch = msg.content.match(/\[\[SWITCH_TO:(.*?)\]\]/);
              if (switchMatch) {
                yield { text: "", done: true, suggestedAgent: switchMatch[1] as AgentMode };
                return;
              }
            }
            if (Array.isArray(msg.tool_calls)) {
              const toolCalls = (msg.tool_calls as Array<Record<string, unknown>>)
                .filter((tc) => {
                  const fn = tc.function as Record<string, unknown> | undefined;
                  return typeof fn?.name === "string";
                })
                .map((tc, idx) => {
                  const fn = tc.function as Record<string, unknown>;
                  return {
                    id: `ollama-${idx}-${Date.now()}`,
                    name: String(fn.name),
                    arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
                  };
                });
              if (toolCalls.length > 0) {
                yield { text: "", done: true, toolCalls };
              }
            }
            if (msg.done === true) {
              yield { text: "", done: true };
              return;
            }
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
