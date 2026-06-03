/**
 * WebSocket Backend Bridge
 *
 * Connects the browser-based ToolExecutor to the local tools-server.mjs.
 * Handles connection lifecycle, request/response matching, and reconnection.
 */

import { toolExecutor, type BackendBridge, type ShellOutput, type FileEntry } from "./toolExecutor";

// ── WebSocket Bridge Implementation ─────────────────────────────────

export class WebSocketBridge implements BackendBridge {
  #url: string;
  #ws: WebSocket | null = null;
  #pending = new Map<string, { resolve: (v: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  #requestId = 0;
  #connected = false;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #onConnectionChange?: (connected: boolean) => void;

  constructor(url = "ws://localhost:7700") {
    this.#url = url;
  }

  get connected(): boolean {
    return this.#connected;
  }

  set onConnectionChange(cb: (connected: boolean) => void) {
    this.#onConnectionChange = cb;
  }

  connect(): void {
    if (this.#ws) return;

    try {
      this.#ws = new WebSocket(this.#url);

      this.#ws.onopen = () => {
        this.#connected = true;
        this.#onConnectionChange?.(true);
      };

      this.#ws.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(String(event.data)) as { id: string; success: boolean; output: string; error?: string };
        const entry = this.#pending.get(data.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.#pending.delete(data.id);
          if (data.success) {
            entry.resolve(data.output);
          } else {
            entry.reject(new Error(data.error ?? "Tool execution failed"));
          }
        }
      };

      this.#ws.onclose = () => {
        this.#connected = false;
        this.#onConnectionChange?.(false);
        this.#rejectAll("Bridge disconnected");
        this.#ws = null;
        // Auto-reconnect
        this.#reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.#ws.onerror = () => {
        this.#connected = false;
        this.#onConnectionChange?.(false);
      };
    } catch (err) {
      console.error('[WebSocketBridge] Connection failed:', err);
      this.#connected = false;
      this.#onConnectionChange?.(false);
    }
  }

  disconnect(): void {
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    this.#rejectAll("Bridge shutting down");
    this.#ws?.close();
    this.#ws = null;
    this.#connected = false;
  }

  #rejectAll(reason: string): void {
    for (const [id, entry] of this.#pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
      this.#pending.delete(id);
    }
  }

  #send(tool: string, args: Record<string, unknown>, timeoutMs = 30000): Promise<string> {
    const id = `req_${++this.#requestId}`;
    const { promise, resolve, reject } = Promise.withResolvers<string>();

    const timer = setTimeout(() => {
      this.#pending.delete(id);
      reject(new Error(`Tool "${tool}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    this.#pending.set(id, { resolve, reject, timer });

    this.#ws?.send(JSON.stringify({ id, tool, args }));

    return promise;
  }

  // ── BackendBridge interface ─────────────────────────────────────

  async execShell(command: string, cwd: string, timeout: number): Promise<ShellOutput> {
    const raw = await this.#send("shell_exec", { command, cwd, timeout }, timeout);
    // Parse the combined output back into structured form
    const lines = String(raw).split("\n");
    const stderrIdx = lines.findIndex((l) => l.startsWith("STDERR:"));
    const exitCodeIdx = lines.findIndex((l) => l.startsWith("EXIT CODE:"));

    let stdout: string;
    let stderr = "";
    let exitCode = 0;

    if (stderrIdx !== -1) {
      stdout = lines.slice(0, stderrIdx).join("\n");
      stderr = lines.slice(stderrIdx + 1, exitCodeIdx !== -1 ? exitCodeIdx : undefined).join("\n").replace("STDERR:\n", "");
    } else {
      stdout = raw;
    }

    if (exitCodeIdx !== -1) {
      exitCode = parseInt(lines[exitCodeIdx].replace("EXIT CODE: ", ""), 10) || 0;
    }

    return { stdout, stderr, exitCode };
  }

  async readFile(path: string, offset: number, limit: number): Promise<string> {
    return this.#send("file_read", { path, offset, limit });
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.#send("file_write", { path, content });
  }

  async editFile(path: string, oldText: string, newText: string): Promise<void> {
    await this.#send("file_edit", { path, old_text: oldText, new_text: newText });
  }

  async searchFiles(pattern: string, path: string, glob: string): Promise<string> {
    return this.#send("file_search", { pattern, path, glob });
  }

  async listFiles(path: string, recursive: boolean, maxDepth: number): Promise<FileEntry[]> {
    const raw = await this.#send("list_files", { path, recursive, max_depth: maxDepth });
    // Parse the text output back into FileEntry[]
    return String(raw)
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const isDir = line.startsWith("[DIR]");
        const parts = line.replace(/^\[DIR\]\s+/, "").trim().split(" (");
        return {
          name: parts[0]?.split("/").pop() ?? "",
          type: isDir ? "directory" : "file",
          size: parseInt(parts[1]?.replace(" bytes)", "") ?? "0", 10),
          path: parts[0] ?? "",
        };
      });
  }

  async fetchUrl(url: string): Promise<string> {
    return this.#send("web_fetch", { url });
  }
}

// ── Singleton ───────────────────────────────────────────────────────

let bridgeInstance: WebSocketBridge | null = null;

export function getBridge(): WebSocketBridge {
  if (!bridgeInstance) {
    bridgeInstance = new WebSocketBridge();
    toolExecutor.setBridge(bridgeInstance);
  }
  return bridgeInstance;
}

export function connectBridge(): void {
  getBridge().connect();
}
