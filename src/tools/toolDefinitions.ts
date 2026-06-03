/**
 * Built-in Tool Definitions
 *
 * Shell execution, file operations, search, and web fetch.
 * Each definition includes a JSON Schema for function calling.
 */

import type { ToolDefinition } from "./types";

// ── Shell Execution ─────────────────────────────────────────────────

export const SHELL_EXEC_TOOL: ToolDefinition = {
  name: "shell_exec",
  description:
    "Execute a shell command in the project directory. Use for running tests, " +
    "installing packages, checking git status, compiling code, etc. Returns " +
    "stdout and stderr. Dangerous commands (rm -rf, sudo, etc.) require approval.",
  requiresApproval: false,
  category: "shell",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
      cwd: {
        type: "string",
        description: "Working directory relative to project root (default: .)",
      },
      timeout: {
        type: "integer",
        description: "Maximum execution time in milliseconds (default: 30000)",
        minimum: 1000,
        maximum: 300000,
      },
    },
    required: ["command"],
  },
};

// ── File Read ───────────────────────────────────────────────────────

export const FILE_READ_TOOL: ToolDefinition = {
  name: "file_read",
  description:
    "Read the contents of a file. Returns the full text content. " +
    "Use offset/limit for large files.",
  requiresApproval: false,
  category: "file",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to project root",
      },
      offset: {
        type: "integer",
        description: "Line number to start reading from (1-indexed, default: 1)",
        minimum: 1,
      },
      limit: {
        type: "integer",
        description: "Maximum number of lines to read (default: 500)",
        minimum: 1,
        maximum: 5000,
      },
    },
    required: ["path"],
  },
};

// ── File Write ──────────────────────────────────────────────────────

export const FILE_WRITE_TOOL: ToolDefinition = {
  name: "file_write",
  description:
    "Write content to a file. Creates the file if it doesn't exist, " +
    "overwrites if it does. Creates parent directories automatically.",
  requiresApproval: true,
  category: "file",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to project root",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
    required: ["path", "content"],
  },
};

// ── File Edit ───────────────────────────────────────────────────────

export const FILE_EDIT_TOOL: ToolDefinition = {
  name: "file_edit",
  description:
    "Edit a file by replacing exact text. Provide the old text and new text. " +
    "The old_text must match exactly including whitespace.",
  requiresApproval: true,
  category: "file",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to project root",
      },
      old_text: {
        type: "string",
        description: "Exact text to find and replace (including whitespace)",
      },
      new_text: {
        type: "string",
        description: "Replacement text",
      },
    },
    required: ["path", "old_text", "new_text"],
  },
};

// ── File Search (grep) ──────────────────────────────────────────────

export const FILE_SEARCH_TOOL: ToolDefinition = {
  name: "file_search",
  description:
    "Search for text patterns across project files using regex. " +
    "Returns matching lines with file paths and line numbers.",
  requiresApproval: false,
  category: "search",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Regex pattern to search for",
      },
      path: {
        type: "string",
        description: "Directory or file to search in (default: project root)",
      },
      glob: {
        type: "string",
        description: "File glob pattern to filter (e.g. '*.ts', 'src/**/*.tsx')",
      },
    },
    required: ["pattern"],
  },
};

// ── Web Fetch ───────────────────────────────────────────────────────

export const WEB_FETCH_TOOL: ToolDefinition = {
  name: "web_fetch",
  description:
    "Fetch content from a URL. Returns the text content of the page. " +
    "Use for reading documentation, API references, or any web content.",
  requiresApproval: false,
  category: "web",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch",
      },
    },
    required: ["url"],
  },
};

// ── List Files ──────────────────────────────────────────────────────

export const LIST_FILES_TOOL: ToolDefinition = {
  name: "list_files",
  description:
    "List files and directories at a given path. Returns names, types, " +
    "and sizes. Useful for exploring project structure.",
  requiresApproval: false,
  category: "file",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Directory path relative to project root (default: .)",
      },
      recursive: {
        type: "boolean",
        description: "Whether to list recursively (default: false)",
      },
      max_depth: {
        type: "integer",
        description: "Maximum recursion depth (default: 2)",
        minimum: 1,
        maximum: 10,
      },
    },
    required: [],
  },
};

// ── All built-in tools ──────────────────────────────────────────────

export const BUILTIN_TOOLS: ToolDefinition[] = [
  SHELL_EXEC_TOOL,
  FILE_READ_TOOL,
  FILE_WRITE_TOOL,
  FILE_EDIT_TOOL,
  FILE_SEARCH_TOOL,
  WEB_FETCH_TOOL,
  LIST_FILES_TOOL,
];

/** Dangerous shell patterns that require human approval */
export const DANGEROUS_SHELL_PATTERNS: string[] = [
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
  "init 0",
  "kill -9 1",
  "killall",
  "pkill",
  "format",
  "del /s",
  "deltree",
];
