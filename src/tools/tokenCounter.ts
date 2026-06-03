/**
 * Token Counter
 *
 * Estimates token counts for messages. Uses the ~4 chars/token heuristic
 * for fast estimation without external dependencies. For production accuracy,
 * swap in a WASM tokenizer (tiktoken/Anthropic) later.
 */

import type { ChatMessage } from "./types";

// ── Constants ───────────────────────────────────────────────────────

/** Average characters per token across English text + code */
const CHARS_PER_TOKEN = 4;

/** Overhead tokens per message (role, separators, metadata) */
const MESSAGE_OVERHEAD = 4;

// ── Public API ──────────────────────────────────────────────────────

/**
 * Estimate token count for a single string.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN) + MESSAGE_OVERHEAD;
}

/**
 * Estimate total token count for an array of chat messages.
 */
export function estimateMessageTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += MESSAGE_OVERHEAD;
    total += estimateTokens(msg.content);

    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += estimateTokens(tc.name);
        total += estimateTokens(tc.arguments);
      }
    }
  }
  // Format overhead for the messages array wrapper
  total += 3;
  return total;
}

/**
 * Given a message history and a token budget, return how many recent messages
 * fit within the budget. Always includes the system message if present.
 */
export function fitMessagesInBudget(
  messages: ChatMessage[],
  tokenBudget: number,
): ChatMessage[] {
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const systemTokens = estimateMessageTokens(systemMessages);
  const remaining = tokenBudget - systemTokens;

  if (remaining <= 0) {
    // Budget only fits system messages; include at least one user message
    const firstUser = nonSystemMessages.find((m) => m.role === "user");
    return firstUser ? [...systemMessages, firstUser] : systemMessages;
  }

  // Fit as many recent non-system messages as possible
  const fitted: ChatMessage[] = [];
  let used = 0;
  // Walk backwards through non-system messages
  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(nonSystemMessages[i].content) + MESSAGE_OVERHEAD;
    if (used + msgTokens > remaining) break;
    fitted.unshift(nonSystemMessages[i]);
    used += msgTokens;
  }

  return [...systemMessages, ...fitted];
}

/**
 * Token budget breakdown for display / debugging.
 */
export interface TokenBudgetBreakdown {
  system: number;
  history: number;
  total: number;
  budget: number;
  remaining: number;
  percentUsed: number;
}

export function analyzeTokenBudget(
  messages: ChatMessage[],
  budget: number,
): TokenBudgetBreakdown {
  const systemTokens = estimateMessageTokens(
    messages.filter((m) => m.role === "system"),
  );
  const historyTokens = estimateMessageTokens(
    messages.filter((m) => m.role !== "system"),
  );
  const total = systemTokens + historyTokens;
  return {
    system: systemTokens,
    history: historyTokens,
    total,
    budget,
    remaining: Math.max(0, budget - total),
    percentUsed: budget > 0 ? Math.round((total / budget) * 100) : 0,
  };
}
