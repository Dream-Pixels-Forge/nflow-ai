
import { GoogleGenAI } from "@google/genai";
import { AgentMode, Message, ToolState, Task, SuggestionLevel } from "../types";
import { getSystemInstruction } from "./promptUtils";

export interface StreamChunk {
  text: string;
  done: boolean;
  sources?: string[];
  suggestedAgent?: AgentMode;
}

export const sendMessageToGeminiStream = async function* (
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  suggestionLevel: SuggestionLevel = 'medium'
): AsyncGenerator<StreamChunk> {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey });
  
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
  const recentHistory = history
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .slice(-15) 
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

  const systemInstruction = getSystemInstruction(agent, tools, projectSummary, currentTasks, suggestionLevel) + contextInjection;

  try {
    const response = await ai.models.generateContentStream({
      model: "gemini-2.0-flash",
      contents: recentHistory,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 8192,
      }
    });

    let fullText = "";

    for await (const chunk of response) {
      const chunkText = chunk.text || "";
      fullText += chunkText;
      
      yield {
        text: chunkText,
        done: false
      };
    }

    // Parse final response for sources and suggested agent
    const sources: string[] = [];
    let suggestedAgent: AgentMode | undefined;

    // Simple URL extraction
    const urlRegex = /https?:\/\/[^\s\)]+/g;
    const urls = fullText.match(urlRegex);
    if (urls) sources.push(...urls);

    // Check for agent suggestion
    const agentMatch = fullText.match(/\[SUGGEST_SWITCH:(\w+)\]/);
    if (agentMatch) {
      suggestedAgent = agentMatch[1] as AgentMode;
    }

    yield {
      text: "",
      done: true,
      sources: sources.length > 0 ? sources : undefined,
      suggestedAgent
    };

  } catch (error) {
    throw error;
  }
};
