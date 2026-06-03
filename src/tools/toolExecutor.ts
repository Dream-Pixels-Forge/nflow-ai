/**
 * Tool Executor
 *
 * Sandboxed execution of tool calls. Runs shell commands and file operations
 * in a controlled environment with approval gates for dangerous operations.
 *
 * NOTE: In a browser context, shell/file operations are proxied through a
 * local backend. This module defines the execution interface and the
 * approval logic. The actual I/O is delegated to the backend bridge.
 */

import type { ToolCall, ToolResult, ToolDefinition } from "./types";
import { DANGEROUS_SHELL_PATTERNS } from "./toolDefinitions";

// ── Approval gate ───────────────────────────────────────────────────

export interface ApprovalRequest {
  toolCallId: string;
  toolName: string;
  command: string;
  reason: string;
}

export type ApprovalResponse = "approved" | "denied";

// ── Backend bridge interface ────────────────────────────────────────
// The actual file system / shell access is provided by a local backend.
// This interface abstracts that boundary.

export interface BackendBridge {
  execShell(command: string, cwd: string, timeout: number): Promise<ShellOutput>;
  readFile(path: string, offset: number, limit: number): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  editFile(path: string, oldText: string, newText: string): Promise<void>;
  searchFiles(pattern: string, path: string, glob: string): Promise<string>;
  listFiles(path: string, recursive: boolean, maxDepth: number): Promise<FileEntry[]>;
  fetchUrl(url: string): Promise<string>;
}

export interface ShellOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  path: string;
}

// ── Tool Executor ───────────────────────────────────────────────────

export class ToolExecutor {
  #bridge: BackendBridge | null = null;
  #approvalHandler: ((request: ApprovalRequest) => Promise<ApprovalResponse>) | null = null;
  #toolRegistry: Map<string, ToolDefinition> = new Map();
  #executionHistory: ToolResult[] = [];

  get history(): ToolResult[] {
    return this.#executionHistory;
  }

  setBridge(bridge: BackendBridge): void {
    this.#bridge = bridge;
  }

  setApprovalHandler(
    handler: (request: ApprovalRequest) => Promise<ApprovalResponse>,
  ): void {
    this.#approvalHandler = handler;
  }

  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.#toolRegistry.set(tool.name, tool);
    }
  }

  getRegisteredTools(): ToolDefinition[] {
    return [...this.#toolRegistry.values()];
  }

  // ── Execute a tool call ─────────────────────────────────────────

  async execute(
    toolCall: ToolCall,
    projectRoot: string,
  ): Promise<ToolResult> {
    const definition = this.#toolRegistry.get(toolCall.name);
    if (!definition) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: false,
        output: "",
        error: `Unknown tool: ${toolCall.name}`,
        approved: false,
      };
    }

    const args = parseArguments(toolCall.arguments);
    if (args === null) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: false,
        output: "",
        error: `Invalid arguments for ${toolCall.name}: not valid JSON`,
        approved: false,
      };
    }

    // Check approval requirement
    const needsApproval =
      definition.requiresApproval || this.#needsApproval(definition, args);

    if (needsApproval && this.#approvalHandler) {
      const request: ApprovalRequest = {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        command: describeAction(definition.name, args),
        reason: this.#getApprovalReason(definition, args),
      };
      const response = await this.#approvalHandler(request);
      if (response === "denied") {
        const result: ToolResult = {
          toolCallId: toolCall.id,
          name: toolCall.name,
          success: false,
          output: "",
          error: "Operation denied by user",
          approved: false,
        };
        this.#executionHistory.push(result);
        return result;
      }
    }

    if (!this.#bridge) {
      const result: ToolResult = {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: false,
        output: "",
        error: "No backend bridge connected. Tool execution unavailable.",
        approved: !needsApproval,
      };
      this.#executionHistory.push(result);
      return result;
    }

    try {
      const result = await this.#dispatch(definition.name, args, projectRoot);
      const toolResult: ToolResult = {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: true,
        output: result,
        approved: !needsApproval,
      };
      this.#executionHistory.push(toolResult);
      return toolResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: ToolResult = {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: false,
        output: "",
        error: message,
        approved: !needsApproval,
      };
      this.#executionHistory.push(result);
      return result;
    }
  }

  clearHistory(): void {
    this.#executionHistory.length = 0;
  }

  // ── Private dispatch ────────────────────────────────────────────

  async #dispatch(
    toolName: string,
    args: Record<string, unknown>,
    projectRoot: string,
  ): Promise<string> {
    const bridge = this.#bridge!;

    switch (toolName) {
      case "shell_exec": {
        const command = String(args.command ?? "");
        const cwd = String(args.cwd ?? projectRoot);
        const timeout = clampNumber(Number(args.timeout ?? 30000), 1000, 300000);
        const output = await bridge.execShell(command, cwd, timeout);
        const parts: string[] = [];
        if (output.stdout) parts.push(output.stdout);
        if (output.stderr) parts.push(`STDERR:\n${output.stderr}`);
        if (output.exitCode !== 0) parts.push(`EXIT CODE: ${output.exitCode}`);
        return parts.join("\n") || "(no output)";
      }

      case "file_read": {
        const path = String(args.path ?? "");
        const offset = clampNumber(Number(args.offset ?? 1), 1, 100000);
        const limit = clampNumber(Number(args.limit ?? 500), 1, 5000);
        return await bridge.readFile(path, offset, limit);
      }

      case "file_write": {
        const path = String(args.path ?? "");
        const content = String(args.content ?? "");
        await bridge.writeFile(path, content);
        return `File written: ${path} (${content.length} bytes)`;
      }

      case "file_edit": {
        const path = String(args.path ?? "");
        const oldText = String(args.old_text ?? "");
        const newText = String(args.new_text ?? "");
        await bridge.editFile(path, oldText, newText);
        return `File edited: ${path}`;
      }

      case "file_search": {
        const pattern = String(args.pattern ?? "");
        const searchPath = String(args.path ?? ".");
        const glob = String(args.glob ?? "*");
        return await bridge.searchFiles(pattern, searchPath, glob);
      }

      case "list_files": {
        const listPath = String(args.path ?? ".");
        const recursive = Boolean(args.recursive ?? false);
        const maxDepth = clampNumber(Number(args.max_depth ?? 2), 1, 10);
        const entries = await bridge.listFiles(listPath, recursive, maxDepth);
        return entries
          .map(
            (e) =>
              `${e.type === "directory" ? "[DIR] " : "      "}${e.path} (${e.size} bytes)`,
          )
          .join("\n");
      }

      case "web_fetch": {
        const url = String(args.url ?? "");
        return await bridge.fetchUrl(url);
      }

      default:
        throw new Error(`Tool "${toolName}" not implemented`);
    }
  }

  // ── Approval logic ──────────────────────────────────────────────

  #needsApproval(definition: ToolDefinition, args: Record<string, unknown>): boolean {
    if (definition.name === "shell_exec") {
      const command = String(args.command ?? "").toLowerCase();
      return DANGEROUS_SHELL_PATTERNS.some((pattern) => command.includes(pattern));
    }
    return false;
  }

  #getApprovalReason(definition: ToolDefinition, args: Record<string, unknown>): string {
    if (definition.name === "shell_exec") {
      const command = String(args.command ?? "");
      const matched = DANGEROUS_SHELL_PATTERNS.find((p) =>
        command.toLowerCase().includes(p),
      );
      return matched
        ? `Command contains dangerous pattern: "${matched}"`
        : "Shell command requires approval";
    }
    return `${definition.name} requires approval`;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseArguments(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    // JSON parse failure expected for malformed input
    return null;
  }
}

function describeAction(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "shell_exec":
      return `Execute: ${String(args.command ?? "")}`;
    case "file_write":
      return `Write file: ${String(args.path ?? "")}`;
    case "file_edit":
      return `Edit file: ${String(args.path ?? "")}`;
    default:
      return toolName;
  }
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// ── Singleton ───────────────────────────────────────────────────────

export const toolExecutor = new ToolExecutor();
