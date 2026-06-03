/**
 * Tool System
 *
 * Exports all tool-related types, definitions, executor, and agentic loop.
 */

export type {
  JSONSchemaString,
  JSONSchemaNumber,
  JSONSchemaBoolean,
  JSONSchemaArray,
  JSONSchemaObject,
  JSONSchemaPrimitive,
  JSONSchemaProperty,
  ToolParameterSchema,
  ToolDefinition,
  ToolCall,
  ToolResult,
  FunctionDeclaration,
  ProviderToolSchema,
  AgenticLoopConfig,
  AgenticLoopResult,
  ChatMessage,
} from "./types";

export {
  BUILTIN_TOOLS,
  SHELL_EXEC_TOOL,
  FILE_READ_TOOL,
  FILE_WRITE_TOOL,
  FILE_EDIT_TOOL,
  FILE_SEARCH_TOOL,
  WEB_FETCH_TOOL,
  LIST_FILES_TOOL,
  DANGEROUS_SHELL_PATTERNS,
} from "./toolDefinitions";

export {
  ToolExecutor,
  toolExecutor,
} from "./toolExecutor";
export type {
  ApprovalRequest,
  ApprovalResponse,
  BackendBridge,
  ShellOutput,
  FileEntry,
} from "./toolExecutor";

export {
  WebSocketBridge,
  getBridge,
  connectBridge,
} from "./webSocketBridge";

export {
  runAgenticLoop,
  agentTurn,
  formatToolResults,
} from "./agenticLoop";
export type {
  LLMProvider,
  LLMResponse,
} from "./agenticLoop";

export {
  estimateTokens,
  estimateMessageTokens,
  fitMessagesInBudget,
  analyzeTokenBudget,
} from "./tokenCounter";
export type {
  TokenBudgetBreakdown,
} from "./tokenCounter";
