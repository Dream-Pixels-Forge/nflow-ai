
import { sendMessageToGemini } from "./geminiService";
import { sendMessageToOllama } from "./ollamaService";
import { sendMessageToOpenRouter, DEFAULT_OPENROUTER_CONFIG } from "./openRouterService";
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

export const sendMessageToAgent = async (
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
      // Determine which model to use
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
        targetModel || settings.ollamaGeneralModel,
        settings.chatMode
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
        },
        settings.chatMode
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
        },
        settings.chatMode
      );
    }

    case 'gemini':
    default: {
      // Default to Gemini
      return sendMessageToGemini(
        prompt,
        history,
        agent,
        tools,
        projectSummary,
        currentTasks,
        settings.suggestionLevel,
        settings.geminiApiKey || '',
        settings.chatMode
      );
    }
  }
};
