/**
 * NexusFlow Tool Bridge Server
 *
 * A lightweight Node.js server that bridges the browser UI to local
 * filesystem and shell operations. Runs on ws://localhost:7700.
 *
 * Usage:
 *   node tools-server.mjs [--port 7700] [--root /path/to/project]
 *
 * The browser connects via WebSocket and sends tool requests.
 * This server executes them safely and returns results.
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { existsSync } from "node:fs";

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const port = getArg(args, "--port", 7700);
const projectRoot = resolve(getArg(args, "--root", "."));

// ── Dangerous patterns ──────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  "rm -rf",
  "rm -r /",
  "sudo",
  "chmod 777",
  "mkfs",
  "dd if=",
  "> /dev/",
  ":(){ :|:& };:",
  "shutdown",
  "reboot",
  "kill -9 1",
  "killall",
  "format",
];

// ── HTTP server (health check) ──────────────────────────────────────

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", root: projectRoot }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

// ── WebSocket server ────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  console.log(`[bridge] Client connected`);

  ws.on("message", async (raw) => {
    let request;
    try {
      request = JSON.parse(String(raw));
    } catch {
      ws.send(JSON.stringify({ id: "", success: false, output: "", error: "Invalid JSON" }));
      return;
    }

    const { id, tool, args: toolArgs, projectRoot: reqRoot } = request;
    const root = reqRoot ? resolve(reqRoot) : projectRoot;

    try {
      const result = await dispatch(tool, toolArgs ?? {}, root);
      ws.send(JSON.stringify({ id, success: true, output: result }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ws.send(JSON.stringify({ id, success: false, output: "", error: message }));
    }
  });

  ws.on("close", () => {
    console.log(`[bridge] Client disconnected`);
  });
});

// ── Tool dispatch ───────────────────────────────────────────────────

async function dispatch(tool, args, root) {
  switch (tool) {
    case "shell_exec":
      return execShell(args.command ?? "", args.cwd ?? ".", root, args.timeout ?? 30000);

    case "file_read":
      return readFileContent(args.path ?? "", root, args.offset ?? 1, args.limit ?? 500);

    case "file_write":
      await writeFileContent(args.path ?? "", args.content ?? "", root);
      return `File written: ${args.path} (${(args.content ?? "").length} bytes)`;

    case "file_edit":
      await editFileContent(args.path ?? "", args.old_text ?? "", args.new_text ?? "", root);
      return `File edited: ${args.path}`;

    case "file_search":
      return searchFiles(args.pattern ?? "", args.path ?? ".", root);

    case "list_files":
      return listFiles(args.path ?? ".", root, Boolean(args.recursive), args.max_depth ?? 2);

    case "web_fetch":
      return fetchUrl(args.url ?? "");

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

// ── Shell execution ─────────────────────────────────────────────────

function execShell(command, cwd, root, timeout) {
  // Check dangerous patterns
  const lower = command.toLowerCase();
  const matched = DANGEROUS_PATTERNS.find((p) => lower.includes(p));
  if (matched) {
    throw new Error(`Blocked: command contains dangerous pattern "${matched}"`);
  }

  const { promise, resolve, reject } = Promise.withResolvers();
  const workDir = join(root, cwd);
  const child = execFile(
    "bash",
    ["-c", command],
    { cwd: workDir, timeout, maxBuffer: 1024 * 1024 },
    (error, stdout, stderr) => {
      if (error && error.killed) {
        reject(new Error(`Command timed out after ${timeout}ms`));
        return;
      }
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode: error?.code ?? 0 });
    },
  );

  // Race with timeout
  const timer = setTimeout(() => {
    child.kill("SIGTERM");
  }, timeout);

  promise.then(
    (result) => {
      clearTimeout(timer);
      const parts = [];
      if (result.stdout) parts.push(result.stdout);
      if (result.stderr) parts.push(`STDERR:\n${result.stderr}`);
      if (result.exitCode !== 0) parts.push(`EXIT CODE: ${result.exitCode}`);
      resolve(parts.join("\n") || "(no output)");
    },
    (err) => {
      clearTimeout(timer);
      reject(err);
    },
  );

  return promise;
}

// ── File read ───────────────────────────────────────────────────────

async function readFileContent(path, root, offset, limit) {
  const fullPath = join(root, path);
  const content = await readFile(fullPath, "utf-8");
  const lines = content.split("\n");
  const start = Math.max(0, offset - 1);
  const end = Math.min(lines.length, start + limit);
  return lines.slice(start, end).map((line, i) => `${start + i + 1}: ${line}`).join("\n");
}

// ── File write ──────────────────────────────────────────────────────

async function writeFileContent(path, content, root) {
  const fullPath = join(root, path);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, content, "utf-8");
}

// ── File edit ───────────────────────────────────────────────────────

async function editFileContent(path, oldText, newText, root) {
  const fullPath = join(root, path);
  const content = await readFile(fullPath, "utf-8");
  if (!content.includes(oldText)) {
    throw new Error(`Text not found in ${path}`);
  }
  await writeFile(fullPath, content.replace(oldText, newText), "utf-8");
}

// ── File search (grep) ─────────────────────────────────────────────

async function searchFiles(pattern, searchPath, root) {
  const { stdout } = await execFilePromise(
    "grep",
    ["-rn", "--include=*", pattern, searchPath],
    root,
  );
  return stdout || "(no matches)";
}

function execFilePromise(command, args, cwd) {
  const { promise, resolve, reject } = Promise.withResolvers();
  execFile(command, args, { cwd, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error && error.code !== 1) {
      // grep exits with 1 when no matches found, that's not an error
      reject(error);
      return;
    }
    resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
  });
  return promise;
}

// ── List files ──────────────────────────────────────────────────────

async function listFiles(dirPath, root, recursive, maxDepth) {
  const entries = [];
  await walkDir(join(root, dirPath), root, entries, recursive ? maxDepth : 1, 0);
  return entries
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => `${e.type === "directory" ? "[DIR]" : "     "} ${e.path} (${e.size} bytes)`)
    .join("\n");
}

async function walkDir(dir, root, entries, maxDepth, depth) {
  if (depth >= maxDepth) return;
  if (!existsSync(dir)) return;

  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    // Skip hidden and common non-essential dirs
    if (item.name.startsWith(".") || item.name === "node_modules" || item.name === "dist") continue;

    const fullPath = join(dir, item.name);
    const relPath = relative(root, fullPath);
    const isDir = item.isDirectory();

    if (isDir) {
      entries.push({ path: relPath, type: "directory", size: 0 });
      await walkDir(fullPath, root, entries, maxDepth, depth + 1);
    } else {
      const s = await stat(fullPath).catch(() => ({ size: 0 }));
      entries.push({ path: relPath, type: "file", size: s.size });
    }
  }
}

// ── Web fetch ───────────────────────────────────────────────────────

async function fetchUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}

// ── Helpers ─────────────────────────────────────────────────────────

function getArg(args, name, fallback) {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

// ── Start ───────────────────────────────────────────────────────────

httpServer.listen(port, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  NexusFlow Tool Bridge Server                ║
║  WebSocket: ws://localhost:${String(port).padEnd(5)}              ║
║  Health:    http://localhost:${String(port).padEnd(5)}/health     ║
║  Project:   ${projectRoot.slice(0, 30).padEnd(30)}  ║
╚══════════════════════════════════════════════╝
`);
});
