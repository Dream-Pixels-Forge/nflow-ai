/**
 * Tool System Types
 *
 * Standardized tool schemas for function calling across all AI providers.
 * Follows OpenAI function calling spec which Gemini, Ollama, OpenRouter, NVIDIA all support.
 */

// ── JSON Schema primitives ──────────────────────────────────────────

export interface JSONSchemaString {
  type: "string";
  description?: string;
  enum?: string[];
}

export interface JSONSchemaNumber {
  type: "number" | "integer";
  description?: string;
  minimum?: number;
  maximum?: number;
}

export interface JSONSchemaBoolean {
  type: "boolean";
  description?: string;
}

export interface JSONSchemaArray {
  type: "array";
  items: JSONSchemaPrimitive;
  description?: string;
}

export interface JSONSchemaObject {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  description?: string;
}

export type JSONSchemaPrimitive =
  | JSONSchemaString
  | JSONSchemaNumber
  | JSONSchemaBoolean;

export type JSONSchemaProperty = JSONSchemaPrimitive | JSONSchemaArray | JSONSchemaObject;

// ── Tool definition ─────────────────────────────────────────────────

export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  /** Whether this tool requires human approval before execution */
  requiresApproval: boolean;
  /** Categories for UI grouping */
  category: "file" | "shell" | "search" | "web" | "agent";
}

// ── Tool call (from model response) ─────────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

// ── Tool execution result ───────────────────────────────────────────

export interface ToolResult {
  toolCallId: string;
  name: string;
  success: boolean;
  output: string;
  error?: string;
  /** Whether this result was produced with human approval */
  approved: boolean;
}

// ── Provider-agnostic function calling format ───────────────────────
// Maps to OpenAI `tools` param, Gemini `functionDeclarations`,
// Ollama `tools` array.

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ProviderToolSchema {
  functionDeclarations: FunctionDeclaration[];
}

// ── Agentic loop types ──────────────────────────────────────────────

export interface AgenticLoopConfig {
  maxIterations: number;
  maxTokens: number;
  temperature: number;
  /** Tools available to the agent */
  tools: ToolDefinition[];
  /** Callback fired on each tool execution */
  onToolCall?: (call: ToolCall) => void;
  /** Callback fired on each tool result */
  onToolResult?: (result: ToolResult) => void;
  /** Callback for streaming text chunks */
  onTextChunk?: (chunk: string) => void;
  /** Whether to require human approval for dangerous tools */
  requireApproval: boolean;
}

export interface AgenticLoopResult {
  text: string;
  toolCalls: ToolResult[];
  iterations: number;
  finishReason: "completed" | "max_iterations" | "error";
  error?: string;
}

// ── Chat message with tool calls ────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
