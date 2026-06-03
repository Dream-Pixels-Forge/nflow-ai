
import { GoogleGenAI, Tool } from "@google/genai";
import { AgentMode, Message, ToolState, Task, SuggestionLevel, ChatMode } from "../types";
import { getSystemInstruction } from "./promptUtils";

export const sendMessageToGemini = async (
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  suggestionLevel: SuggestionLevel = 'medium',
  apiKey: string = '',
  chatMode: ChatMode = 'agent'
): Promise<{ text: string; sources?: string[]; suggestedAgent?: AgentMode }> => {
  if (!apiKey) {
    throw new Error("API Key not found. Set your Gemini API key in Settings, or switch to Ollama.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    // Construct Context from Tools
    let contextInjection = "";
    
    // RAG: Inject file content
    if (tools.rag.active && tools.rag.content.length > 0) {
      contextInjection += `\n\n[SYSTEM: RAG CONTEXT LOADED]\nThe following information is provided from the local knowledge base. Use it to answer the user's request:\n${tools.rag.content.join('\n---\n')}\n`;
    }
    
    // MCP: Simulate connection context
    if (tools.mcp.active) {
      contextInjection += `\n\n[SYSTEM: MCP BRIDGE ACTIVE]\nYou are connected to a local MCP server on port ${tools.mcp.port}. You can assume access to local system commands if the user requests them.`;
    }

    // Fetch: Prepare prompt for search
    if (tools.fetch.active) {
      if (tools.fetch.targetUrl) {
         contextInjection += `\n\n[SYSTEM: WEB FETCH CONFIG]\nThe user is interested in this specific URL: ${tools.fetch.targetUrl}. Use your search tool to find information about it if needed.`;
      } else {
         contextInjection += `\n\n[SYSTEM: WEB FETCH CONFIG]\nWeb search is ENABLED. You may search the web to answer the user's request.`;
      }
    }

    // Filter history to valid chat roles (user/assistant) and map to Gemini API format (user/model)
    // Only take the recent history for THIS specific agent
    const recentHistory = history
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .slice(-15) 
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // Configure Tools
    const apiTools: Tool[] = [];
    if (tools.fetch.active) {
      apiTools.push({ googleSearch: {} });
    }

    // Inject context into the user's prompt
    const finalPrompt = contextInjection ? `${contextInjection}\n\nUSER REQUEST: ${prompt}` : prompt;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: getSystemInstruction(agent, projectSummary, currentTasks, suggestionLevel, chatMode),
        temperature: 0.7,
        tools: apiTools.length > 0 ? apiTools : undefined
      },
      history: recentHistory
    });

    const result = await chat.sendMessage({ message: finalPrompt });
    let responseText = result.text || "No response generated.";
    
    // Extract Suggested Agent Switch
    let suggestedAgent: AgentMode | undefined;
    const switchRegex = /\[\[SWITCH_TO:(.*?)\]\]/;
    const switchMatch = responseText.match(switchRegex);
    if (switchMatch) {
      const agentId = switchMatch[1].trim() as AgentMode;
      if (Object.values(AgentMode).includes(agentId)) {
        suggestedAgent = agentId;
      }
      // Remove the tag from the visible text
      responseText = responseText.replace(switchMatch[0], '').trim();
    }

    // Extract Grounding Metadata (Sources)
    let sources: string[] = [];
    if (result.candidates && result.candidates[0]?.groundingMetadata?.groundingChunks) {
      sources = result.candidates[0].groundingMetadata.groundingChunks
        .map(chunk => chunk.web?.uri)
        .filter((uri): uri is string => !!uri);
    }

    return {
      text: responseText,
      sources: sources.length > 0 ? Array.from(new Set(sources)) : undefined,
      suggestedAgent
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to communicate with agent core.";
    console.error("Gemini API Error:", error);
    return {
      text: `[SYSTEM ERROR]: ${message}`
    };
  }
};
