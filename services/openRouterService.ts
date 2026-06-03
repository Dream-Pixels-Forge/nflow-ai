
import { AgentMode, Message, ToolState, Task, SuggestionLevel, ChatMode } from "../types";
import { getSystemInstruction, buildContextInjection, extractAgentSwitch } from "./promptUtils";

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
  config: OpenRouterConfig = DEFAULT_OPENROUTER_CONFIG,
  chatMode: ChatMode = 'agent'
): Promise<{ text: string; sources?: string[]; suggestedAgent?: AgentMode }> => {
  
  try {
    const contextInjection = buildContextInjection(tools);

    // Build messages array
    const systemMsg: OpenRouterMessage = {
      role: 'system',
      content: getSystemInstruction(agent, projectSummary, currentTasks, suggestionLevel, chatMode)
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

    // Call OpenRouter API with function calling support
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    // Attach tool definitions if the caller provides them via contextInjection
    const toolDefs = extractToolDefsFromContext(contextInjection);
    if (toolDefs.length > 0) {
      requestBody.tools = toolDefs.map((td) => ({
        type: "function",
        function: {
          name: td.name,
          description: td.description,
          parameters: td.parameters,
        },
      }));
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'NexusFlow'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API Error: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();
    const rawText = data.choices[0]?.message?.content || "No response generated.";
    const { cleanText, suggestedAgent } = extractAgentSwitch(rawText);

    return {
      text: cleanText,
      suggestedAgent
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to connect to OpenRouter API.";
    console.error("OpenRouter Service Error:", error);
    return {
      text: `[OPENROUTER ERROR]: ${message}\n\nTip: Get your API key from https://openrouter.ai/keys`
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
    return data.data?.map((m: { id?: string }) => m.id) || OPENROUTER_MODELS.map(m => m.id);
  } catch (error) {
    console.warn("Failed to fetch OpenRouter models:", error);
    return OPENROUTER_MODELS.map(m => m.id);
  }
};
// ── Streaming ──────────────────────────────────────────────────────

export interface OpenRouterStreamChunk {
  text: string;
  done: boolean;
  suggestedAgent?: AgentMode;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

export async function* sendMessageToOpenRouterStream(
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  suggestionLevel: SuggestionLevel = 'medium',
  config: OpenRouterConfig = DEFAULT_OPENROUTER_CONFIG,
  chatMode: ChatMode = 'agent'
): AsyncGenerator<OpenRouterStreamChunk> {
  let contextInjection = "";
  if (tools.rag.active && tools.rag.content.length > 0) {
    contextInjection += `\n\n[SYSTEM: RAG CONTEXT LOADED]\n${tools.rag.content.join('\n---\n')}\n`;
  }
  if (tools.mcp.active) {
    contextInjection += `\n\n[SYSTEM: MCP BRIDGE ACTIVE]\nConnected to local MCP server on port ${tools.mcp.port}.`;
  }

  const systemMsg: OpenRouterMessage = {
    role: 'system',
    content: getSystemInstruction(agent, projectSummary, currentTasks, suggestionLevel, chatMode)
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

  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 4096,
    stream: true,
  };

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'NexusFlow'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API Error: ${response.status} ${errorData.error?.message || response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  const collectedToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          // Flush any remaining tool calls
          const toolCalls = [...collectedToolCalls.values()];
          yield { text: "", done: true, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
          return;
        }

        try {
          const parsed: unknown = JSON.parse(data);
          if (parsed !== null && typeof parsed === "object" && "choices" in parsed) {
            const obj = parsed as Record<string, unknown>;
            const choices = obj.choices as Array<Record<string, unknown>> | undefined;
            const choice = choices?.[0];
            if (!choice) continue;

            const delta = choice.delta as Record<string, unknown> | undefined;
            if (!delta) continue;

            // Text chunk
            if (typeof delta.content === "string") {
              yield { text: delta.content, done: false };
              // Check for agent switch suggestion in accumulated content
              const switchMatch = delta.content.match(/\[\[SWITCH_TO:(.*?)\]\]/);
              if (switchMatch) {
                yield { text: "", done: true, suggestedAgent: switchMatch[1] as AgentMode };
                return;
              }
            }

            // Tool call chunks (streamed incrementally)
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
                const tcIndex = Number(tc.index ?? 0);
                const existing = collectedToolCalls.get(tcIndex);
                const tcFunc = tc.function as Record<string, unknown> | undefined;
                if (existing) {
                  if (typeof tcFunc?.arguments === "string") existing.arguments += tcFunc.arguments;
                } else {
                  collectedToolCalls.set(tcIndex, {
                    id: String(tc.id ?? `call_${tcIndex}`),
                    name: String(tcFunc?.name ?? ""),
                    arguments: String(tcFunc?.arguments ?? ""),
                  });
                }
              }
            }
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const finalToolCalls = [...collectedToolCalls.values()];
  if (finalToolCalls.length > 0) {
    yield { text: "", done: true, toolCalls: finalToolCalls };
  }
}

// ── Tool definition extraction helper ───────────────────────────────
// This is a temporary bridge until services accept tools directly.

interface ToolDefForProvider {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

function extractToolDefsFromContext(_context: string): ToolDefForProvider[] {
  // Future: parse tool definitions from context injection
  return [];
}

