
import { GoogleGenAI } from "@google/genai";
import { AgentMode, Message, ToolState, Task, SuggestionLevel, ChatMode } from "../types";
import { getSystemInstruction } from "./promptUtils";

export interface StreamChunk {
  text: string;
  done: boolean;
  sources?: string[];
  suggestedAgent?: AgentMode;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

export const sendMessageToGeminiStream = async function* (
  prompt: string,
  history: Message[],
  agent: AgentMode,
  tools: ToolState,
  projectSummary: string = "",
  currentTasks: Task[] = [],
  suggestionLevel: SuggestionLevel = 'medium',
  apiKey: string = '',
  chatMode: ChatMode = 'agent',
  model: string = 'gemini-2.0-flash'
): AsyncGenerator<StreamChunk> {
  if (!apiKey) {
    throw new Error("API Key not found. Set your Gemini API key in Settings, or switch to Ollama.");
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

  const systemInstruction = getSystemInstruction(agent, projectSummary, currentTasks, suggestionLevel, chatMode) + contextInjection;

  try {
    const response = await ai.models.generateContentStream({
      model: model,
      contents: recentHistory,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 8192,
        tools: tools.fetch.active ? [{ googleSearch: {} }] : undefined,
      }
    });

    let fullText = "";
    let groundingChunks: Array<{ web?: { uri?: string } }> = [];

    for await (const chunk of response) {
      const chunkText = chunk.text || "";
      fullText += chunkText;

      // Collect grounding metadata from streaming chunks
      if ((chunk as any).groundingMetadata?.groundingChunks) {
        groundingChunks.push(...(chunk as any).groundingMetadata.groundingChunks);
      }
      
      yield {
        text: chunkText,
        done: false
      };
    }

    // Parse final response for sources and suggested agent
    const sources: string[] = [];

    // Extract from grounding metadata (structured sources)
    if (groundingChunks.length > 0) {
      const uris = groundingChunks
        .map(chunk => chunk.web?.uri)
        .filter((uri): uri is string => !!uri);
      sources.push(...Array.from(new Set(uris)));
    }

    // Fallback: extract URLs from text
    if (sources.length === 0) {
      const urlRegex = /https?:\/\/[^\s\)]+/g;
      const urls = fullText.match(urlRegex);
      if (urls) sources.push(...urls);
    }

    // Check for agent suggestion
    const agentMatch = fullText.match(/\[\[SWITCH_TO:(.*?)\]\]/);
    let suggestedAgent: AgentMode | undefined;
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
