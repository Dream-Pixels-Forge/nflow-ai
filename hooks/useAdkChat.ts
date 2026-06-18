/**
 * ADK-powered agent chat hook.
 *
 * Same UseAgentChatReturn interface as the legacy hook.
 * Uses ADK Runner for Gemini provider; falls back to legacy dispatch otherwise.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { AgentMode, Message, ToolState, Task, AppSettings, VirtualFile } from "../types";
import { AgentMode as AM } from "../types";
import type { Runner } from "../src/adk/index";
import {
  memoryManager,
  agentOrchestrator,
  contextManager,
  taskManager,
  collaborationManager,
} from "../src/agentic";
import { ragManager } from "../src/rag/RAGManager";
import { loadMessages, saveMessage, clearMessages } from "../src/persistence";
import { sendMessageToAgentStream } from "../services/aiStreamService";
import { stripAgentSwitchTags } from "../services/promptUtils";

let adkModule: Promise<typeof import("../src/adk/index")> | null = null;

// ── Public API (same as useAgentChat) ─────────────────────────────────

export interface UseAgentChatProps {
  activeAgent: AgentMode;
  toolState: ToolState;
  settings: AppSettings;
  tasks: Task[];
  virtualFiles: VirtualFile[];
  onTasksUpdate: (tasks: Task[]) => void;
  onFilesUpdate: (files: VirtualFile[]) => void;
}

export interface UseAgentChatReturn {
  input: string;
  setInput: (input: string) => void;
  agentHistories: Record<AgentMode, Message[]>;
  isProcessing: boolean;
  pendingSwitch: AgentMode | null;
  setPendingSwitch: (agent: AgentMode | null) => void;
  handleSendMessage: (overrideInput?: string) => Promise<void>;
  deleteMessage: (messageId: string) => void;
  undoDelete: () => void;
  showUndoToast: boolean;
  rerunMessage: (messageId: string) => void;
  clearAllMessages: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

function inferAgentForTask(title: string): AgentMode {
  const lower = title.toLowerCase();
  if (lower.includes("plan") || lower.includes("requirement")) return AM.PLAN;
  if (lower.includes("test") || lower.includes("verify")) return AM.TEST;
  if (lower.includes("deploy") || lower.includes("docker")) return AM.DEPLOY;
  if (lower.includes("architect") || lower.includes("design")) return AM.ARCHITECT;
  if (lower.includes("monitor") || lower.includes("perform")) return AM.MONITOR;
  if (lower.includes("secure") || lower.includes("auth")) return AM.SECURE;
  return AM.CODER;
}

function streamId(base: string): string {
  return `stream-${base}`;
}

// ── Hook ─────────────────────────────────────────────────────────────

export const useAdkChat = ({
  activeAgent,
  toolState,
  settings,
  tasks,
  virtualFiles,
  onTasksUpdate,
  onFilesUpdate,
}: UseAgentChatProps): UseAgentChatReturn => {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<AM | null>(null);
  const [lastAgentResume, setLastAgentResume] = useState("");
  const toolIterationRef = useRef(0);
  const runnerRef = useRef<Runner | null>(null);
  // Initialize ADK Runner when settings point to Gemini (dynamic import — ADK is Node-only)
  useEffect(() => {
    if (settings.aiProvider !== "gemini") {
      runnerRef.current = null;
      return;
    }
    let cancelled = false;
    (adkModule ??= import("../src/adk/index")).then((mod) => {
      if (cancelled) return;
      const model = (settings.geminiModel || "gemini-2.0-flash")
        .replace(/^gemini\//, "").replace(/^models\//, "");
      runnerRef.current = mod.createAdkRunner({ model, sessionService: mod.sessionService });
    }).catch((err) => {
      if (cancelled) return;
      console.warn("[ADK] Failed to load @google/adk in browser:", err);
      console.warn("[ADK] ADK is a Node.js SDK — Gemini will fall back to legacy @google/genai streaming.");
      runnerRef.current = null;
    });
    return () => { cancelled = true; };
  }, [settings.aiProvider, settings.geminiModel]);

  const pendingDispatchRef = useRef<{ targetAgent: AM; message: string } | null>(null);

  // Project context sync
  useEffect(() => {
    const files = virtualFiles.map((f) => `- ${f.name} (${f.language})`).join("\n");
    const tsks = tasks.map((t) => `- [${t.status}] ${t.title}`).join("\n");
    setLastAgentResume(
      `PROJECT CONTEXT:\nVirtual Files:\n${files || "No files loaded"}\n\nActive Tasks:\n${tsks || "No tasks defined"}`,
    );
  }, [virtualFiles, tasks]);

  // Per-agent message histories
  const [agentHistories, setAgentHistories] = useState<Record<AM, Message[]>>(() => {
    const h = {} as Record<AM, Message[]>;
    for (const mode of Object.values(AM)) {
      h[mode] =
        mode === AM.CHAT
          ? [{ id: "init", role: "system" as const, content: "NEXUSFLOW CORE ONLINE. PROJECT FOLDER INITIALIZED.", timestamp: Date.now(), agent: AM.CHAT }]
          : [];
    }
    return h;
  });

  // Load persisted messages on mount
  const isLoaded = useRef(false);
  useEffect(() => {
    if (isLoaded.current) return;
    isLoaded.current = true;
    (async () => {
      const loaded: Partial<Record<AM, Message[]>> = {};
      for (const mode of Object.values(AM)) {
        const msgs = await loadMessages(mode);
        if (msgs.length > 0) loaded[mode] = msgs;
      }
      if (Object.keys(loaded).length > 0) {
        setAgentHistories((prev) => {
          const next = { ...prev };
          for (const [mode, msgs] of Object.entries(loaded)) next[mode as AM] = msgs;
          return next;
        });
      }
    })();
  }, []);

  // Persist only the active agent's messages on change (debounced)
  useEffect(() => {
    if (!isLoaded.current) return;
    const id = setTimeout(() => {
      const msgs = agentHistories[activeAgent];
      if (msgs) {
        const nonSystem = msgs.filter((m) => m.role !== "system");
        if (nonSystem.length > 0) saveMessage(activeAgent, nonSystem[nonSystem.length - 1]).catch(() => {});
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [agentHistories, activeAgent]);

  // Auto-dispatch: CHAT agent routes to specialist (disabled when ADK runner active)
  useEffect(() => {
    if (!pendingDispatchRef.current) return;
    if (runnerRef.current) {
      // ADK runner handles routing — clear pending dispatch
      pendingDispatchRef.current = null;
      return;
    }
    const { targetAgent, message } = pendingDispatchRef.current;
    pendingDispatchRef.current = null;
    (async () => {
      const userMsg: Message = { id: Date.now().toString(), role: "user", content: message, timestamp: Date.now(), agent: targetAgent };
      setAgentHistories((prev) => ({ ...prev, [targetAgent]: [...prev[targetAgent], userMsg] }));

      const sid = streamId((Date.now() + 1).toString());
      let acc = "";
      try {
        agentOrchestrator.startHeartbeat(targetAgent);
        for await (const chunk of sendMessageToAgentStream(message, agentHistories[targetAgent], targetAgent, toolState, lastAgentResume, tasks, settings)) {
          if (chunk.done) {
            const final: Message = { id: sid, role: "assistant", content: acc, timestamp: Date.now(), agent: targetAgent, grounding: chunk.sources ? { urls: chunk.sources } : undefined };
            setAgentHistories((prev) => ({ ...prev, [targetAgent]: [...prev[targetAgent].filter((m) => m.id !== sid), final] }));
            if ([AM.CODER, AM.ARCHITECT, AM.TEST, AM.DEPLOY].includes(targetAgent)) extractFiles(acc);
            ragManager.indexMessage("user", message, targetAgent).catch(() => {});
            ragManager.indexMessage("assistant", acc, targetAgent).catch(() => {});
          } else {
            acc += chunk.text;
            setAgentHistories((prev) => {
              const msgs = prev[targetAgent];
              const idx = msgs.findIndex((m) => m.id === sid);
              if (idx >= 0) {
                const upd = [...msgs];
                upd[idx] = { ...upd[idx], content: acc };
                return { ...prev, [targetAgent]: upd };
              }
              return { ...prev, [targetAgent]: [...msgs, { id: sid, role: "assistant", content: acc, timestamp: Date.now(), agent: targetAgent, isStreaming: true }] };
            });
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        setAgentHistories((prev) => ({ ...prev, [targetAgent]: [...prev[targetAgent], { id: (Date.now() + 1).toString(), role: "system", content: `DISPATCH ERROR: ${err}`, timestamp: Date.now(), agent: targetAgent, isError: true }] }));
      } finally {
        agentOrchestrator.stopHeartbeat(targetAgent);
      }
    })();
  }, [agentHistories, toolState, lastAgentResume, tasks, settings]);

  // ── File / Task extraction ─────────────────────────────────────────

  function extractTasks(content: string) {
    const re = /- \[([ x])\] (.*)/g;
    const newTasks: Task[] = [];
    let m;
    while ((m = re.exec(content)) !== null) {
      const title = m[2].trim();
      if (!tasks.some((t) => t.title === title)) {
        newTasks.push({ id: Date.now().toString() + Math.random().toString(36).substring(2, 9), title, status: m[1] === "x" ? "done" as const : "idle" as const, agent: inferAgentForTask(title) });
      }
    }
    if (newTasks.length > 0) {
      onTasksUpdate([...tasks, ...newTasks]);
      try { memoryManager.addMemory({ type: "decision", content: `New tasks: ${newTasks.map((t) => t.title).join(", ")}`, tags: ["tasks", "planning"], importance: "medium", metadata: { tasks: newTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })) }, relatedEntries: [] }); } catch {}
    }
  }

  function extractFiles(content: string) {
    const re = /(?:FILE:|\*\*FILE:\*\*)[ \t]*([^\r\n]+)(?:[\r\n]+\s*)*```(\w*)(?:[\r\n]+)([\s\S]*?)```/g;
    const newFiles: VirtualFile[] = [];
    let m;
    while ((m = re.exec(content)) !== null) {
      const name = m[1].trim();
      const lang = m[2] || "";
      const code = m[3].trim();
      if (name && !newFiles.some((f) => f.name === name)) {
        newFiles.push({ name, content: code, language: lang, status: "unmodified" as const });
      }
    }
    if (newFiles.length > 0) {
      onFilesUpdate(newFiles);
      try { memoryManager.addMemory({ type: "success", content: `New files: ${newFiles.map((f) => f.name).join(", ")}`, tags: ["files", "code-generation"], importance: "medium", metadata: { files: newFiles.map((f) => ({ name: f.name, language: f.language })) }, relatedEntries: [] }); } catch {}
    }
  }

  // ── Send Message ───────────────────────────────────────────────────

  const handleSendMessage = useCallback(async (overrideInput?: string) => {
    const msg = (overrideInput ?? input).trim();
    if (!msg || isProcessing) return;

    const currentInput = msg;
    setInput("");
    setIsProcessing(true);
    setPendingSwitch(null);
    toolIterationRef.current = 0;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: currentInput, timestamp: Date.now(), agent: activeAgent };
    setAgentHistories((prev) => ({ ...prev, [activeAgent]: [...prev[activeAgent], userMsg] }));

    const sid = streamId((Date.now() + 1).toString());
    let acc = "";

    try {
      agentOrchestrator.startHeartbeat(activeAgent);
      agentOrchestrator.recordPulse({ timestamp: new Date().toISOString(), agentId: activeAgent, phase: "I", status: "HEALTHY", currentIntent: currentInput.slice(0, 100), lastReasoningHash: "", resourceUsage: { tokens: 0, latencyMs: 0 } });

      const session = contextManager.createSession(activeAgent);
      contextManager.addMessage(session.id, { role: "user", content: currentInput });
      collaborationManager.analyzeMessage(activeAgent, currentInput);

      const runner = runnerRef.current;
      const useAdk = !!(runner && settings.aiProvider === "gemini");

      if (useAdk) {
        // ── ADK Runner path ──────────────────────────────────────────
        const sid2 = `chat-${Date.now()}`;
        try { await runner.sessionService.createSession({ appName: "nflow-ai", userId: "default", sessionId: sid2 }); } catch { /* exists */ }

        for await (const evt of runner.runAsync({ sessionId: sid2, userId: "default", newMessage: { role: "user", parts: [{ text: currentInput }] } })) {
          const adkEvt = evt as unknown as { finished: boolean; content?: Array<{ parts: Array<{ text: string }> }> };
          if (adkEvt.finished) {
            const display = activeAgent === AM.CHAT ? stripAgentSwitchTags(acc) : acc;
            const final: Message = { id: sid, role: "assistant", content: display, timestamp: Date.now(), agent: activeAgent };
            setAgentHistories((prev) => ({ ...prev, [activeAgent]: [...prev[activeAgent].filter((m) => m.id !== sid), final] }));

            const sessions = contextManager.getAgentSessions(activeAgent);
            if (sessions.length > 0) contextManager.addMessage(sessions[sessions.length - 1].id, { role: "assistant", content: acc });
            ragManager.indexMessage("user", currentInput, activeAgent).catch(() => {});
            ragManager.indexMessage("assistant", acc, activeAgent).catch(() => {});
            if (activeAgent === AM.PLAN) extractTasks(acc);
          } else if (adkEvt.content?.[0]?.parts?.[0]?.text) {
            acc += adkEvt.content[0].parts[0].text;
            if (acc.length % 200 === 0) agentOrchestrator.recordPulse({ timestamp: new Date().toISOString(), agentId: activeAgent, phase: "I", status: "HEALTHY", currentIntent: `Generating: ${acc.slice(0, 50)}...`, lastReasoningHash: "", resourceUsage: { tokens: acc.length / 4, latencyMs: 0 } });

            setAgentHistories((prev) => {
              const msgs = prev[activeAgent];
              const idx = msgs.findIndex((m) => m.id === sid);
              if (idx >= 0) {
                const upd = [...msgs];
                upd[idx] = { ...upd[idx], content: acc };
                return { ...prev, [activeAgent]: upd };
              }
              return { ...prev, [activeAgent]: [...msgs, { id: sid, role: "assistant", content: acc, timestamp: Date.now(), agent: activeAgent, isStreaming: true }] };
            });
          }
        }
      } else {
        // ── Legacy provider dispatch path ────────────────────────────
        for await (const chunk of sendMessageToAgentStream(currentInput, agentHistories[activeAgent], activeAgent, toolState, lastAgentResume, tasks, settings)) {
          if (chunk.done) {
            const display = activeAgent === AM.CHAT ? stripAgentSwitchTags(acc) : acc;
            const final: Message = { id: sid, role: "assistant", content: display, timestamp: Date.now(), agent: activeAgent, grounding: chunk.sources ? { urls: chunk.sources } : undefined, toolCalls: chunk.toolCalls?.length ? chunk.toolCalls : undefined };
            setAgentHistories((prev) => ({ ...prev, [activeAgent]: [...prev[activeAgent].filter((m) => m.id !== sid), final] }));

            const sessions = contextManager.getAgentSessions(activeAgent);
            if (sessions.length > 0) contextManager.addMessage(sessions[sessions.length - 1].id, { role: "assistant", content: acc });
            ragManager.indexMessage("user", currentInput, activeAgent).catch(() => {});
            ragManager.indexMessage("assistant", acc, activeAgent).catch(() => {});

            if (activeAgent === AM.PLAN) extractTasks(acc);
            if ([AM.CODER, AM.ARCHITECT, AM.TEST, AM.DEPLOY].includes(activeAgent)) extractFiles(acc);

            // Tool calls (legacy)
            if (chunk.toolCalls?.length) {
              const { toolExecutor } = await import("../src/tools/toolExecutor");
              const results: Array<{ name: string; success: boolean; output: string; error?: string }> = [];
              for (const tc of chunk.toolCalls) {
                const r = await toolExecutor.execute(tc, ".");
                results.push({ name: r.name, success: r.success, output: r.output.slice(0, 500), error: r.error });
              }
              const sysMsg: Message = { id: (Date.now() + 2).toString(), role: "system", content: `Tool results:\n${results.map((r) => `[${r.success ? "OK" : "FAIL"}] ${r.name}: ${r.success ? r.output.slice(0, 200) : r.error?.slice(0, 200)}`).join("\n")}`, timestamp: Date.now(), agent: activeAgent, toolResults: results };
              setAgentHistories((prev) => ({ ...prev, [activeAgent]: [...prev[activeAgent], sysMsg] }));

              // Follow-up with tool results
              toolIterationRef.current += 1;
              if (toolIterationRef.current < 5) {
                acc = "";
                const fb = `Tool results:\n${results.map((r) => `[${r.success ? "OK" : "FAIL"}] ${r.name}: ${r.success ? r.output.slice(0, 200) : r.error?.slice(0, 200)}`).join("\n")}\n\nContinue.`;
                const sid2 = streamId((Date.now() + 4).toString());
                for await (const fbChunk of sendMessageToAgentStream(fb, agentHistories[activeAgent], activeAgent, toolState, lastAgentResume, tasks, settings)) {
                  if (fbChunk.done) {
                    const fbFinal: Message = { id: sid2, role: "assistant", content: acc, timestamp: Date.now(), agent: activeAgent };
                    setAgentHistories((prev) => ({ ...prev, [activeAgent]: [...prev[activeAgent], fbFinal] }));
                  } else {
                    acc += fbChunk.text;
                  }
                }
              }
            }
          } else {
            acc += chunk.text;
            if (acc.length % 200 === 0) agentOrchestrator.recordPulse({ timestamp: new Date().toISOString(), agentId: activeAgent, phase: "I", status: "HEALTHY", currentIntent: `Generating: ${acc.slice(0, 50)}...`, lastReasoningHash: "", resourceUsage: { tokens: acc.length / 4, latencyMs: 0 } });

            setAgentHistories((prev) => {
              const msgs = prev[activeAgent];
              const idx = msgs.findIndex((m) => m.id === sid);
              if (idx >= 0) {
                const upd = [...msgs];
                upd[idx] = { ...upd[idx], content: acc };
                return { ...prev, [activeAgent]: upd };
              }
              return { ...prev, [activeAgent]: [...msgs, { id: sid, role: "assistant", content: acc, timestamp: Date.now(), agent: activeAgent, isStreaming: true }] };
            });
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      let hint = "";
      if (msg.includes("API Key")) hint = "\n\nHint: Set VITE_API_KEY or switch to Ollama.";
      else if (msg.includes("fetch") || msg.includes("Network")) hint = "\n\nHint: Is Ollama running? OLLAMA_ORIGINS=\"*\" may help.";
      setAgentHistories((prev) => ({ ...prev, [activeAgent]: [...prev[activeAgent], { id: (Date.now() + 1).toString(), role: "system", content: `ERROR: ${msg}${hint}`, timestamp: Date.now(), agent: activeAgent, isError: true }] }));
    } finally {
      setIsProcessing(false);
      agentOrchestrator.stopHeartbeat(activeAgent);
    }
  }, [input, isProcessing, activeAgent, agentHistories, toolState, lastAgentResume, tasks, settings, onTasksUpdate, onFilesUpdate]);

  // ── Message management ────────────────────────────────────────────

  const [deletedMessage, setDeletedMessage] = useState<{ message: Message; agent: AM } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  const deleteMessage = useCallback(
    (messageId: string) => {
      const msg = agentHistories[activeAgent].find((m) => m.id === messageId);
      if (msg) {
        setDeletedMessage({ message: msg, agent: activeAgent });
        setShowUndoToast(true);
        setAgentHistories((prev) => ({ ...prev, [activeAgent]: prev[activeAgent].filter((m) => m.id !== messageId) }));
        setTimeout(() => { setShowUndoToast(false); setDeletedMessage(null); }, 5000);
      }
    },
    [activeAgent, agentHistories],
  );

  const undoDelete = useCallback(() => {
    if (deletedMessage) {
      setAgentHistories((prev) => ({ ...prev, [deletedMessage.agent]: [...prev[deletedMessage.agent], deletedMessage.message] }));
      setShowUndoToast(false);
      setDeletedMessage(null);
    }
  }, [deletedMessage]);

  const rerunMessage = useCallback(
    (messageId: string) => {
      const msgs = agentHistories[activeAgent];
      const msg = msgs.find((m) => m.id === messageId);
      if (msg && msg.role === "user") {
        handleSendMessage(msg.content);
      }
    },
    [activeAgent, agentHistories, handleSendMessage],
  );

  const clearAllMessages = useCallback(() => {
    const h = {} as Record<AM, Message[]>;
    for (const mode of Object.values(AM)) {
      h[mode] = mode === AM.CHAT ? [{ id: "init", role: "system" as const, content: "NEXUSFLOW CORE ONLINE. PROJECT FOLDER INITIALIZED.", timestamp: Date.now(), agent: AM.CHAT }] : [];
    }
    setAgentHistories(h);
    for (const mode of Object.values(AM)) clearMessages(mode).catch(() => {});
  }, []);

  return {
    input, setInput,
    agentHistories, isProcessing,
    pendingSwitch, setPendingSwitch,
    handleSendMessage,
    deleteMessage, undoDelete, showUndoToast,
    rerunMessage, clearAllMessages,
  };
};
