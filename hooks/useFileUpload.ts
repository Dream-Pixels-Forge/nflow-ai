/**
 * useFileUpload Hook
 *
 * Handles file upload via drag-and-drop or file input.
 * Reads text files and images, adds them to the virtual file system context.
 */

import { useState, useCallback, useRef } from "react";
import type { VirtualFile } from "../types";

// ── Supported text extensions ───────────────────────────────────────

const TEXT_EXTENSIONS: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  md: "markdown",
  txt: "text",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  graphql: "graphql",
  dockerfile: "dockerfile",
  makefile: "makefile",
  env: "env",
  gitignore: "gitignore",
  csv: "csv",
  log: "text",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  solidity: "solidity",
  sol: "solidity",
  r: "r",
  R: "r",
  lua: "lua",
  dart: "dart",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  ml: "ocaml",
  clj: "clojure",
  scala: "scala",
  nim: "nim",
  zig: "zig",
  v: "verilog",
  sv: "systemverilog",
  vhdl: "vhdl",
  tf: "terraform",
  hcl: "terraform",
};

// ── Max file size for text (256KB) ──────────────────────────────────

const MAX_TEXT_SIZE = 256 * 1024;

// ── Hook ────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: "text" | "image" | "unsupported";
  language?: string;
  content?: string;
  dataUrl?: string;
  error?: string;
}

interface UseFileUploadReturn {
  uploadedFiles: UploadedFile[];
  isDragging: boolean;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  /** Convert uploaded files to VirtualFile entries for the project context */
  toVirtualFiles: () => VirtualFile[];
  /** Format file contents as context injection for the AI */
  toContextString: () => string;
}

export function useFileUpload(): UseFileUploadReturn {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileIdCounter = useRef(0);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const results: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      const id = `upload-${Date.now()}-${++fileIdCounter.current}`;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const language = TEXT_EXTENSIONS[ext];

      if (language) {
        // Text file
        if (file.size > MAX_TEXT_SIZE) {
          results.push({
            id,
            name: file.name,
            size: file.size,
            type: "unsupported",
            error: `File too large (${formatSize(file.size)}). Max: ${formatSize(MAX_TEXT_SIZE)}`,
          });
          continue;
        }

        try {
          const content = await file.text();
          results.push({
            id,
            name: file.name,
            size: file.size,
            type: "text",
            language,
            content,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({
            id,
            name: file.name,
            size: file.size,
            type: "unsupported",
            error: `Failed to read: ${message}`,
          });
        }
      } else if (file.type.startsWith("image/")) {
        // Image file
        try {
          const dataUrl = await readFileAsDataUrl(file);
          results.push({
            id,
            name: file.name,
            size: file.size,
            type: "image",
            dataUrl,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({
            id,
            name: file.name,
            size: file.size,
            type: "unsupported",
            error: `Failed to read image: ${message}`,
          });
        }
      } else {
        results.push({
          id,
          name: file.name,
          size: file.size,
          type: "unsupported",
          error: `Unsupported file type: ${ext || file.type}`,
        });
      }
    }

    setUploadedFiles((prev) => [...prev, ...results]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
        e.target.value = "";
      }
    },
    [processFiles],
  );

  const removeFile = useCallback((id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  const toVirtualFiles = useCallback((): VirtualFile[] => {
    return uploadedFiles
      .filter((f) => f.type === "text" && f.content !== undefined)
      .map((f) => ({
        name: f.name,
        content: f.content!,
        language: f.language ?? "text",
        status: "new" as const,
      }));
  }, [uploadedFiles]);

  const toContextString = useCallback((): string => {
    const parts: string[] = [];
    for (const file of uploadedFiles) {
      if (file.type === "text" && file.content) {
        parts.push(`--- ${file.name} (${file.language}) ---\n${file.content}`);
      } else if (file.type === "image" && file.dataUrl) {
        parts.push(`--- ${file.name} (image) ---\n[Image attached: ${file.name}]`);
      } else if (file.error) {
        parts.push(`--- ${file.name} ---\n[Error: ${file.error}]`);
      }
    }
    return parts.join("\n\n");
  }, [uploadedFiles]);

  return {
    uploadedFiles,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    removeFile,
    clearFiles,
    toVirtualFiles,
    toContextString,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
  reader.readAsDataURL(file);
  return promise;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
