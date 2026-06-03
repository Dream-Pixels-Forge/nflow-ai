/**
 * Agentic Loop
 *
 * Core execution loop: send messages to model → if model returns tool_calls →
 * execute tools → feed results back → repeat until model returns text or
 * max iterations reached.
 *
 * This is the bridge between "chatbot that describes" and "agent that does".
 */

import type {
  AgenticLoopConfig,
  AgenticLoopResult,
  ChatMessage,
  ToolCall,
  ToolResult,
  FunctionDeclaration,
  ProviderToolSchema,
} from "./types";
import { toolExecutor } from "./toolExecutor";
import { estimateMessageTokens, fitMessagesInBudget } from "./tokenCounter";

// ── Provider-agnostic LLM call interface ────────────────────────────
// The agentic loop doesn't know which provider it's talking to.
// The caller provides this interface.

export interface LLMProvider {
  /**
   * Send messages to the model. Returns text and any tool calls.
   * If the model doesn't support tool calling, toolCalls will be empty.
   */
  chat(
    messages: ChatMessage[],
    tools?: ProviderToolSchema,
  ): Promise<LLMResponse>;
}

export interface LLMResponse {
  text: string;
  toolCalls: ToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | "error";
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// ── Default config ──────────────────────────────────────────────────

const DEFAULT_CONFIG: AgenticLoopConfig = {
  maxIterations: 10,
  maxTokens: 128000,
  temperature: 0.7,
  tools: [],
  requireApproval: true,
};

// ── Agentic Loop ────────────────────────────────────────────────────

export async function runAgenticLoop(
  provider: LLMProvider,
  initialMessages: ChatMessage[],
  config: Partial<AgenticLoopConfig> = {},
): Promise<AgenticLoopResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const allToolResults: ToolResult[] = [];
  let iterations = 0;

  // Register tools with executor
  if (cfg.tools.length > 0) {
    toolExecutor.registerTools(cfg.tools);
  }

  // Build function declarations for the provider
  const functionDeclarations: FunctionDeclaration[] = cfg.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const providerTools: ProviderToolSchema | undefined =
    functionDeclarations.length > 0
      ? { functionDeclarations }
      : undefined;

  // Working copy of messages
  let messages = [...initialMessages];

  while (iterations < cfg.maxIterations) {
    iterations++;

    // Fit messages within token budget
    const fittedMessages = fitMessagesInBudget(messages, cfg.maxTokens);

    // Call the model
    let response: LLMResponse;
    try {
      response = await provider.chat(fittedMessages, providerTools);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        text: "",
        toolCalls: allToolResults,
        iterations,
        finishReason: "error",
        error: message,
      };
    }

    // Stream text chunks to callback
    if (response.text && cfg.onTextChunk) {
      cfg.onTextChunk(response.text);
    }

    // No tool calls → we're done
    if (response.toolCalls.length === 0 || response.finishReason !== "tool_calls") {
      return {
        text: response.text,
        toolCalls: allToolResults,
        iterations,
        finishReason: "completed",
      };
    }

    // Add assistant message with tool calls to history
    messages.push({
      role: "assistant",
      content: response.text || "",
      tool_calls: response.toolCalls,
    });

    // Execute each tool call
    for (const toolCall of response.toolCalls) {
      // Notify callback
      if (cfg.onToolCall) {
        cfg.onToolCall(toolCall);
      }

      // Execute
      const result = await toolExecutor.execute(toolCall, ".");

      // Notify callback
      if (cfg.onToolResult) {
        cfg.onToolResult(result);
      }

      allToolResults.push(result);

      // Add tool result to messages
      messages.push({
        role: "tool",
        content: result.success ? result.output : `Error: ${result.error}`,
        tool_call_id: result.toolCallId,
        name: result.name,
      });
    }
  }

  // Max iterations reached
  return {
    text: "",
    toolCalls: allToolResults,
    iterations,
    finishReason: "max_iterations",
    error: `Reached maximum iterations (${cfg.maxIterations})`,
  };
}

// ── Convenience: single-shot with tool execution ────────────────────

/**
 * Send a prompt and automatically execute any tool calls the model requests.
 * Returns the final text response after all tools have been executed.
 */
export async function agentTurn(
  provider: LLMProvider,
  messages: ChatMessage[],
  config: Partial<AgenticLoopConfig> = {},
): Promise<AgenticLoopResult> {
  return runAgenticLoop(provider, messages, config);
}

// ── Format tool results for display ─────────────────────────────────

export function formatToolResults(results: ToolResult[]): string {
  if (results.length === 0) return "";
  return results
    .map((r) => {
      const status = r.success ? "✓" : "✗";
      const output = r.success ? truncate(r.output, 500) : `Error: ${r.error}`;
      return `[${status}] ${r.name}: ${output}`;
    })
    .join("\n");
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n... (truncated)";
}
