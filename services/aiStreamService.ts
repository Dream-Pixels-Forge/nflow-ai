import { sendMessageToGeminiStream, StreamChunk } from "./geminiStreamService";
import { sendMessageToOllama, sendMessageToOllamaStream } from "./ollamaService";
import { sendMessageToOpenRouter, sendMessageToOpenRouterStream, DEFAULT_OPENROUTER_CONFIG } from "./openRouterService";
import { sendMessageToNVIDIA, DEFAULT_NVIDIA_CONFIG } from "./nvidiaService";
import { AgentMode, Message, ToolState, Task, AppSettings } from "../types";

const TECHNICAL_AGENTS = [
  AgentMode.CODER,
  AgentMode.ARCHITECT,
  AgentMode.TEST,
  AgentMode.SECURE,
  AgentMode.DEPLOY,
  AgentMode.MONITOR,
  AgentMode.PLAN
];

/**
 * Unified streaming interface for all providers.
 * Real streaming for Gemini, Ollama, and OpenRouter.
 * NVIDIA falls back to simulated streaming (single chunk).
 */
export const sendMessageToAgentStream = async function* (
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  settings: AppSettings
): AsyncGenerator<StreamChunk> {

  switch (settings.aiProvider) {
    case 'gemini':
      yield* sendMessageToGeminiStream(
        prompt, history, agent, tools, projectSummary, currentTasks, settings.suggestionLevel, settings.geminiApiKey || '', settings.chatMode, settings.geminiModel || 'gemini-2.0-flash'
      );
      break;

    case 'ollama': {
      const isTechnical = TECHNICAL_AGENTS.includes(agent);
      const targetModel = isTechnical ? settings.ollamaCodingModel : settings.ollamaGeneralModel;
      yield* sendMessageToOllamaStream(
        prompt, history, agent, tools, projectSummary, currentTasks,
        settings.suggestionLevel, settings.ollamaUrl, targetModel || settings.ollamaGeneralModel, settings.chatMode
      );
      break;
    }

    case 'openrouter': {
      const config = {
        apiKey: settings.openrouterApiKey || '',
        model: settings.openrouterModel || 'anthropic/claude-3.5-sonnet',
        baseUrl: 'https://openrouter.ai/api/v1'
      };
      yield* sendMessageToOpenRouterStream(
        prompt, history, agent, tools, projectSummary, currentTasks,
        settings.suggestionLevel, config, settings.chatMode
      );
      break;
    }

    default: {
      // NVIDIA: simulated streaming (single response chunked)
      const response = await fetchProviderResponse(prompt, history, agent, tools, projectSummary, currentTasks, settings);
      const chunkSize = 10;
      for (let i = 0; i < response.text.length; i += chunkSize) {
        yield {
          text: response.text.slice(i, i + chunkSize),
          done: false
        };
        await new Promise<void>((resolve) => { setTimeout(resolve, 20); resolve(); });
      }
      yield {
        text: "",
        done: true,
        sources: response.sources,
        suggestedAgent: response.suggestedAgent
      };
      break;
    }
  }
};

// Non-streaming fallback for NVIDIA
const fetchProviderResponse = async (
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  settings: AppSettings
): Promise<{ text: string; sources?: string[]; suggestedAgent?: AgentMode }> => {
  
  switch (settings.aiProvider) {
    case 'ollama': {
      const isTechnical = TECHNICAL_AGENTS.includes(agent);
      const targetModel = isTechnical ? settings.ollamaCodingModel : settings.ollamaGeneralModel;

      return sendMessageToOllama(
        prompt,
        history,
        agent,
        tools,
        projectSummary,
        currentTasks,
        settings.suggestionLevel,
        settings.ollamaUrl,
        targetModel || settings.ollamaGeneralModel
      );
    }

    case 'openrouter': {
      return sendMessageToOpenRouter(
        prompt,
        history,
        agent,
        tools,
        projectSummary,
        currentTasks,
        settings.suggestionLevel,
        {
          apiKey: settings.openrouterApiKey || '',
          model: settings.openrouterModel || DEFAULT_OPENROUTER_CONFIG.model,
          baseUrl: DEFAULT_OPENROUTER_CONFIG.baseUrl
        }
      );
    }

    case 'nvidia': {
      return sendMessageToNVIDIA(
        prompt,
        history,
        agent,
        tools,
        projectSummary,
        currentTasks,
        settings.suggestionLevel,
        {
          apiKey: settings.nvidiaApiKey || '',
          model: settings.nvidiaModel || DEFAULT_NVIDIA_CONFIG.model,
          baseUrl: settings.nvidiaBaseUrl || DEFAULT_NVIDIA_CONFIG.baseUrl
        }
      );
    }

    default: {
      throw new Error(`Unsupported provider: ${settings.aiProvider}`);
    }
  }
};
