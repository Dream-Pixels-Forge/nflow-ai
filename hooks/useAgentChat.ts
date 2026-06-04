import { useState, useCallback, useRef, useEffect } from 'react';
import { AGENTS, AgentMode, Message, ToolState, Task, AppSettings, VirtualFile } from '../types';
import { sendMessageToAgent } from '../services/aiService';
import { sendMessageToAgentStream } from '../services/aiStreamService';
import { stripAgentSwitchTags } from '../services/promptUtils';
import { memoryManager, agentOrchestrator, contextManager, taskManager, collaborationManager } from '../src/agentic';
import { loadMessages, saveMessage, saveMessages, clearMessages, loadSettings, saveSettings } from '../src/persistence';

const MAX_TOOL_ITERATIONS = 5;
const MAX_TOOL_RESULT_LENGTH = 500;

// Sanitize tool output to prevent prompt injection
function sanitizeToolOutput(output: string | undefined): string {
  if (!output) return '';
  return output
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Strip control chars except \n\t
    .split('\n')
    .map(line => line.substring(0, 200)) // Cap line length
    .join('\n')
    .substring(0, MAX_TOOL_RESULT_LENGTH);
}

interface UseAgentChatProps {
  activeAgent: AgentMode;
  toolState: ToolState;
  settings: AppSettings;
  tasks: Task[];
  virtualFiles: VirtualFile[];
  onTasksUpdate: (tasks: Task[]) => void;
  onFilesUpdate: (files: VirtualFile[]) => void;
}

interface UseAgentChatReturn {
  input: string;
  setInput: (input: string) => void;
  agentHistories: Record<AgentMode, Message[]>;
  isProcessing: boolean;
  pendingSwitch: AgentMode | null;
  setPendingSwitch: (agent: AgentMode | null) => void;
  handleSendMessage: () => Promise<void>;
  deleteMessage: (messageId: string) => void;
  undoDelete: () => void;
  showUndoToast: boolean;
  rerunMessage: (messageId: string) => void;
  clearAllMessages: () => void;
}

// Helper to infer agent from task title
const inferAgentForTask = (title: string): AgentMode => {
  const lower = title.toLowerCase();
  if (lower.includes('plan') || lower.includes('requirement') || lower.includes('user stor') || lower.includes('acceptance criteria')) return AgentMode.PLAN;
  if (lower.includes('test') || lower.includes('verify')) return AgentMode.TEST;
  if (lower.includes('deploy') || lower.includes('docker') || lower.includes('ci/cd')) return AgentMode.DEPLOY;
  if (lower.includes('design') || lower.includes('architecture')) return AgentMode.ARCHITECT;
  if (lower.includes('monitor') || lower.includes('log') || lower.includes('performance')) return AgentMode.MONITOR;
  if (lower.includes('secure') || lower.includes('auth') || lower.includes('vulnerability')) return AgentMode.SECURE;
  return AgentMode.CODER; // Default to Coder
};

export const useAgentChat = ({
  activeAgent,
  toolState,
  settings,
  tasks,
  virtualFiles,
  onTasksUpdate,
  onFilesUpdate
}: UseAgentChatProps): UseAgentChatReturn => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<AgentMode | null>(null);
  const [lastAgentResume, setLastAgentResume] = useState('');
  const toolIterationRef = useRef(0);
  
  // Auto-dispatch: when CHAT agent suggests SWITCH_TO, route the message to target agent
  const pendingDispatchRef = useRef<{ targetAgent: AgentMode; message: string } | null>(null);
  
  // Update project context whenever files or tasks change
  useEffect(() => {
    const fileList = virtualFiles.map(f => `- ${f.name} (${f.language})`).join('\n');
    const taskList = tasks.map(t => `- [${t.status}] ${t.title}`).join('\n');
    
    const projectSummary = `PROJECT CONTEXT:
Virtual Files:
${fileList || 'No files loaded'}

Active Tasks:
${taskList || 'No tasks defined'}`;
    
    setLastAgentResume(projectSummary);
  }, [virtualFiles, tasks]);
  
  // State: Independent Histories for each Agent (The "Project Folder" Structure)
  const [agentHistories, setAgentHistories] = useState<Record<AgentMode, Message[]>>(() => {
    const initialHistories = {} as Record<AgentMode, Message[]>;
    Object.values(AgentMode).forEach(mode => {
      initialHistories[mode] = mode === AgentMode.CHAT ? [{
        id: 'init',
        role: 'system',
        content: 'NEXUSFLOW CORE ONLINE. PROJECT FOLDER INITIALIZED.',
        timestamp: Date.now(),
        agent: AgentMode.CHAT
      }] : [];
    });
    return initialHistories;
  });
  // Persistence: Load messages from IndexedDB on mount
  const isLoaded = useRef(false);
  useEffect(() => {
    if (isLoaded.current) return;
    isLoaded.current = true;

    const loadAllMessages = async () => {
      const loaded: Partial<Record<AgentMode, Message[]>> = {};
      for (const mode of Object.values(AgentMode)) {
        const messages = await loadMessages(mode);
        if (messages.length > 0) {
          loaded[mode] = messages;
        }
      }

      if (Object.keys(loaded).length > 0) {
        setAgentHistories((prev) => {
          const next = { ...prev };
          for (const [mode, messages] of Object.entries(loaded)) {
            next[mode as AgentMode] = messages;
          }
          return next;
        });
      }
    };

    loadAllMessages().catch(console.error);
  }, []);

  // Persistence: Save messages when they change (debounced)
  useEffect(() => {
    if (!isLoaded.current) return;

    const timeoutId = setTimeout(() => {
      for (const [mode, messages] of Object.entries(agentHistories)) {
        // Only save non-system messages
        const nonSystem = messages.filter((m) => m.role !== "system");
        if (nonSystem.length > 0) {
          saveMessage(mode as AgentMode, nonSystem[nonSystem.length - 1]).catch(
            console.error,
          );
        }
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [agentHistories]);

  // Auto-dispatch: when CHAT agent detects SWITCH_TO, route the message to target agent
  useEffect(() => {
    if (!pendingDispatchRef.current) return;
    
    const { targetAgent, message } = pendingDispatchRef.current;
    pendingDispatchRef.current = null; // consume immediately

    const dispatchToAgent = async () => {
      // Add user message to target agent's history
      const dispatchUserMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
        agent: targetAgent
      };
      setAgentHistories(prev => ({
        ...prev,
        [targetAgent]: [...prev[targetAgent], dispatchUserMsg]
      }));

      // Stream response from target agent
      const dispatchStreamMsgId = (Date.now() + 1).toString();
      let dispatchStreamedContent = "";

      try {
        agentOrchestrator.startHeartbeat(targetAgent);
        const stream = sendMessageToAgentStream(
          message,
          agentHistories[targetAgent],
          targetAgent,
          toolState,
          lastAgentResume,
          tasks,
          settings
        );

        for await (const chunk of stream) {
          if (chunk.done) {
            const finalMsg: Message = {
              id: dispatchStreamMsgId,
              role: 'assistant',
              content: dispatchStreamedContent,
              timestamp: Date.now(),
              agent: targetAgent,
              grounding: chunk.sources ? { urls: chunk.sources } : undefined,
            };
            setAgentHistories(prev => ({
              ...prev,
              [targetAgent]: [...prev[targetAgent].filter(m => m.id !== dispatchStreamMsgId), finalMsg]
            }));

            // Extract files if applicable
            if ([AgentMode.CODER, AgentMode.ARCHITECT, AgentMode.TEST, AgentMode.DEPLOY].includes(targetAgent)) {
              extractFilesFromContent(dispatchStreamedContent);
            }
          } else {
            dispatchStreamedContent += chunk.text;
            setAgentHistories(prev => {
              const messages = prev[targetAgent];
              const existingIdx = messages.findIndex(m => m.id === dispatchStreamMsgId);
              if (existingIdx >= 0) {
                const updated = [...messages];
                updated[existingIdx] = { ...updated[existingIdx], content: dispatchStreamedContent };
                return { ...prev, [targetAgent]: updated };
              } else {
                return { ...prev, [targetAgent]: [...messages, {
                  id: dispatchStreamMsgId,
                  role: 'assistant',
                  content: dispatchStreamedContent,
                  timestamp: Date.now(),
                  agent: targetAgent,
                  isStreaming: true
                }]};
              }
            });
          }
        }
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: `DISPATCH ERROR: ${errMessage}`,
          timestamp: Date.now(),
          agent: targetAgent,
          isError: true
        };
        setAgentHistories(prev => ({
          ...prev,
          [targetAgent]: [...prev[targetAgent], errorMsg]
        }));
      } finally {
        agentOrchestrator.stopHeartbeat(targetAgent);
      }
    };

    dispatchToAgent();
  }, [agentHistories, toolState, lastAgentResume, tasks, settings]);

  // Parse tasks from PLAN agent output
  const extractTasksFromContent = (content: string) => {
     // Regex to find "- [ ] Task" patterns
     const taskRegex = /- \[([ x])\] (.*)/g;
     let match;
     const newTasks: Task[] = [];
     
     while ((match = taskRegex.exec(content)) !== null) {
        const isChecked = match[1] === 'x';
        const title = match[2].trim();
        
        // Avoid duplicates (simple check)
        if (!tasks.some(t => t.title === title)) {
            newTasks.push({
                id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                title: title,
                status: isChecked ? 'done' : 'idle',
                agent: inferAgentForTask(title)
            });
        }
     }

     if (newTasks.length > 0) {
       onTasksUpdate([...tasks, ...newTasks]);
       
       // Save to memory
       memoryManager.addMemory({
         type: 'decision',
         content: `New tasks created: ${newTasks.map(t => t.title).join(', ')}`,
         tags: ['tasks', 'planning'],
         importance: 'medium',
         metadata: { tasks: newTasks.map(t => ({ id: t.id, title: t.title, status: t.status })) },
         relatedEntries: []
       });
     }
  };

  // Parse Files from CODER/ARCHITECT/TEST outputs
  const extractFilesFromContent = (content: string) => {
    // Regex: FILE: filename.ext \n ```lang \n content \n ```
    const fileRegex = /(?:FILE:|\*\*FILE:\*\*)[ \t]*([^\r\n]+)(?:[\r\n]+\s*)*```(\w*)(?:[\r\n]+)([\s\S]*?)```/g;
    
    let match;
    const newFiles: VirtualFile[] = [];
    
    while ((match = fileRegex.exec(content)) !== null) {
        const fileName = match[1].trim();
        const fileContent = match[3]; // Group 3 is content
        newFiles.push({
            name: fileName,
            content: fileContent,
            language: fileName.split('.').pop() || 'text',
            status: 'new'
        });
    }
    
    if (newFiles.length > 0) {
        onFilesUpdate(newFiles);
        
        // Save to memory
        memoryManager.addMemory({
          type: 'success',
          content: `New files generated: ${newFiles.map(f => f.name).join(', ')}`,
          tags: ['files', 'code-generation'],
          importance: 'medium',
          metadata: { files: newFiles.map(f => ({ name: f.name, language: f.language })) },
          relatedEntries: []
        });
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const currentInput = input;
    setInput('');
    setIsProcessing(true);
    setPendingSwitch(null);
    toolIterationRef.current = 0;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      timestamp: Date.now(),
      agent: activeAgent
    };

    // Update LOCAL history for this agent
    setAgentHistories(prev => ({
      ...prev,
      [activeAgent]: [...prev[activeAgent], userMsg]
    }));

    // Create a temporary message ID for streaming
    const streamingMsgId = (Date.now() + 1).toString();
    let streamedContent = "";

    try {
      // Start heartbeat for this agent
      agentOrchestrator.startHeartbeat(activeAgent);
      agentOrchestrator.recordPulse({
        timestamp: new Date().toISOString(),
        agentId: activeAgent,
        phase: 'I',
        status: 'HEALTHY',
        currentIntent: currentInput.slice(0, 100),
        lastReasoningHash: '',
        resourceUsage: { tokens: 0, latencyMs: 0 }
      });

      // Create context session for this conversation
      const session = contextManager.createSession(activeAgent);
      contextManager.addMessage(session.id, { role: 'user', content: currentInput });

      // Analyze message for collaboration signals
      collaborationManager.analyzeMessage(activeAgent, currentInput);
      const suggestions = collaborationManager.generateSuggestions(activeAgent);

      // Use streaming AI Service
      const stream = sendMessageToAgentStream(
        currentInput, 
        agentHistories[activeAgent], 
        activeAgent, 
        toolState, 
        lastAgentResume,
        tasks,
        settings
      );

      // Process stream chunks
      let pendingToolCalls: Array<{ id: string; name: string; arguments: string }> = [];

      for await (const chunk of stream) {
        if (chunk.done) {
          // Check for tool calls in the final chunk
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            pendingToolCalls = chunk.toolCalls;
          }

          // Strip SWITCH_TO tags from displayed content (routing metadata, not user-facing)
          const displayContent = activeAgent === AgentMode.CHAT 
            ? stripAgentSwitchTags(streamedContent) 
            : streamedContent;

          // Stream finished - finalize the message
          const finalMsg: Message = {
            id: streamingMsgId,
            role: 'assistant',
            content: displayContent,
            timestamp: Date.now(),
            agent: activeAgent,
            grounding: chunk.sources ? { urls: chunk.sources } : undefined,
            toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
          };

          // Replace the streaming message with final version
          setAgentHistories(prev => ({
            ...prev,
            [activeAgent]: [...prev[activeAgent].filter(m => m.id !== streamingMsgId), finalMsg]
          }));

          // Add assistant message to context session
          const sessions = contextManager.getAgentSessions(activeAgent);
          if (sessions.length > 0) {
            const latestSession = sessions[sessions.length - 1];
            contextManager.addMessage(latestSession.id, { role: 'assistant', content: streamedContent });
          }

          // Execute tool calls if present
          if (pendingToolCalls.length > 0) {
            const { toolExecutor } = await import("../src/tools/toolExecutor");
            const toolResults: Array<{ name: string; success: boolean; output: string; error?: string }> = [];

            for (const tc of pendingToolCalls) {
              const result = await toolExecutor.execute(tc, ".");
              toolResults.push({
                name: result.name,
                success: result.success,
                output: result.output.slice(0, MAX_TOOL_RESULT_LENGTH),
                error: result.error,
              });
            }

            // Add tool results as a system message for context
            const toolResultMsg: Message = {
              id: (Date.now() + 2).toString(),
              role: 'system',
              content: `Tool execution results:\n${toolResults.map(r => `[${r.success ? "OK" : "FAIL"}] ${r.name}: ${r.success ? sanitizeToolOutput(r.output) : sanitizeToolOutput(r.error)}`).join("\n")}`,
              timestamp: Date.now(),
              agent: activeAgent,
              toolResults,
            };

            setAgentHistories(prev => ({
              ...prev,
              [activeAgent]: [...prev[activeAgent], toolResultMsg]
            }));

            // Feed tool results back into model for continuation (with iteration guard)
            toolIterationRef.current += 1;
            if (toolIterationRef.current < MAX_TOOL_ITERATIONS) {
              const feedbackContent = `Tool execution results:\n${toolResults.map(r => `[${r.success ? "OK" : "FAIL"}] ${r.name}: ${r.success ? sanitizeToolOutput(r.output) : sanitizeToolOutput(r.error)}`).join("\n")}\n\nPlease continue with your task.`;

              const feedbackStream = sendMessageToAgentStream(
                feedbackContent,
                agentHistories[activeAgent],
                activeAgent,
                toolState,
                lastAgentResume,
                tasks,
                settings
              );

              let feedbackContent累积 = "";
              let feedbackToolCalls: Array<{ id: string; name: string; arguments: string }> = [];

              for await (const chunk of feedbackStream) {
                if (chunk.done) {
                  if (chunk.toolCalls && chunk.toolCalls.length > 0) {
                    feedbackToolCalls = chunk.toolCalls;
                  }

                  const feedbackMsg: Message = {
                    id: (Date.now() + 4).toString(),
                    role: 'assistant',
                    content: feedbackContent累积,
                    timestamp: Date.now(),
                    agent: activeAgent,
                    toolCalls: feedbackToolCalls.length > 0 ? feedbackToolCalls : undefined,
                  };

                  setAgentHistories(prev => ({
                    ...prev,
                    [activeAgent]: [...prev[activeAgent], feedbackMsg]
                  }));

                  // If the feedback response also has tool calls, they'll be handled in the next iteration
                  if (feedbackToolCalls.length > 0) {
                    pendingToolCalls = feedbackToolCalls;
                    // Re-execute the tool loop by setting chunk.done to trigger recursion
                    // This is handled by the outer while loop
                  }
                } else {
                  feedbackContent累积 += chunk.text;
                }
              }
            }
          }

          // Task Extraction (Only if PLAN agent)
          if (activeAgent === AgentMode.PLAN) {
            extractTasksFromContent(streamedContent);
          }

          // File Extraction (Coder, Architect, Test, Deploy)
          if ([AgentMode.CODER, AgentMode.ARCHITECT, AgentMode.TEST, AgentMode.DEPLOY].includes(activeAgent)) {
            extractFilesFromContent(streamedContent);
          }

          // COORDINATOR ENFORCEMENT: CHAT agent should not generate code
          if (activeAgent === AgentMode.CHAT) {
            const codeBlockRegex = /```[\s\S]*?```/g;
            const fileTagRegex = /FILE:\s*\S+/g;
            const hasCode = codeBlockRegex.test(streamedContent) || fileTagRegex.test(streamedContent);
            
            if (hasCode) {
              // Add a warning message
              const warningMsg: Message = {
                id: (Date.now() + 3).toString(),
                role: 'system',
                content: '⚠️ The CHAT agent detected code in its response. Code generation should be handled by the CODER agent. Consider switching to CODER for implementation tasks.',
                timestamp: Date.now(),
                agent: activeAgent,
                isError: false
              };
              setAgentHistories(prev => ({
                ...prev,
                [activeAgent]: [...prev[activeAgent], warningMsg]
              }));
            }
          }

          // Handle Orchestrator Suggestion — AUTO-DISPATCH
          if (chunk.suggestedAgent && chunk.suggestedAgent !== activeAgent) {
            setPendingSwitch(chunk.suggestedAgent);
            
            // Create A2A Task for context handoff
            taskManager.createTask({
              agentId: chunk.suggestedAgent,
              priority: 'medium',
              input: [{
                role: 'user',
                content: currentInput,
                parts: [{ type: 'text', data: currentInput }],
                timestamp: new Date().toISOString()
              }],
              metadata: {
                sourceAgent: activeAgent,
                handoffReason: 'orchestrator-suggestion',
                contextSummary: streamedContent.slice(0, 500)
              }
            });

            // AUTO-DISPATCH: Route the message to the target agent
            if (activeAgent === AgentMode.CHAT) {
              pendingDispatchRef.current = {
                targetAgent: chunk.suggestedAgent,
                message: currentInput
              };
            }
          }
        } else {
          // Accumulate streamed text
          streamedContent += chunk.text;

          // Update agent heartbeat periodically
          if (streamedContent.length % 200 === 0) {
            agentOrchestrator.recordPulse({
              timestamp: new Date().toISOString(),
              agentId: activeAgent,
              phase: 'I',
              status: 'HEALTHY',
              currentIntent: `Generating: ${streamedContent.slice(0, 50)}...`,
              lastReasoningHash: '',
              resourceUsage: { tokens: streamedContent.length / 4, latencyMs: 0 }
            });
          }

          // Update the streaming message in history
          setAgentHistories(prev => {
            const messages = prev[activeAgent];
            const existingIdx = messages.findIndex(m => m.id === streamingMsgId);

            if (existingIdx >= 0) {
              // Update existing streaming message
              const updated = [...messages];
              updated[existingIdx] = {
                ...updated[existingIdx],
                content: streamedContent
              };
              return { ...prev, [activeAgent]: updated };
            } else {
              // Create new streaming message
              const streamingMsg: Message = {
                id: streamingMsgId,
                role: 'assistant',
                content: streamedContent,
                timestamp: Date.now(),
                agent: activeAgent,
                isStreaming: true
              };
              return { ...prev, [activeAgent]: [...messages, streamingMsg] };
            }
          });
        }
      }

    } catch (error) {
      // Extract meaningful error message
      const errMessage = error instanceof Error ? error.message : String(error);

      // Provider-specific hints
      let hint = "";
      if (errMessage.includes("API Key not found")) {
        hint = "\n\nHint: Set VITE_API_KEY in your .env file, or switch to Ollama in Settings.";
      } else if (errMessage.includes("Failed to fetch") || errMessage.includes("NetworkError")) {
        hint = "\n\nHint: Check if your AI provider is running. For Ollama, ensure it's running with OLLAMA_ORIGINS=\"*\".";
      } else if (errMessage.includes("401") || errMessage.includes("403")) {
        hint = "\n\nHint: Invalid API key. Check your settings.";
      }

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `ERROR: ${errMessage}${hint}`,
        timestamp: Date.now(),
        agent: activeAgent,
        isError: true
      };
      setAgentHistories(prev => ({
        ...prev,
        [activeAgent]: [...prev[activeAgent], errorMsg]
      }));
    } finally {
      setIsProcessing(false);
      // Stop heartbeat when done
      agentOrchestrator.stopHeartbeat(activeAgent);
    }
  }, [input, isProcessing, activeAgent, agentHistories, toolState, lastAgentResume, tasks, settings, onTasksUpdate, onFilesUpdate]);

  // Undo state for message deletion
  const [deletedMessage, setDeletedMessage] = useState<{message: Message, agent: AgentMode} | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Delete a message by ID with undo support
  const deleteMessage = useCallback((messageId: string) => {
    const currentMessages = agentHistories[activeAgent];
    const msgToDelete = currentMessages.find(msg => msg.id === messageId);
    if (msgToDelete) {
      setDeletedMessage({ message: msgToDelete, agent: activeAgent });
      setShowUndoToast(true);
      setAgentHistories(prev => ({
        ...prev,
        [activeAgent]: prev[activeAgent].filter(msg => msg.id !== messageId)
      }));
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setShowUndoToast(false);
        setDeletedMessage(null);
      }, 5000);
    }
  }, [activeAgent, agentHistories]);

  // Undo delete
  const undoDelete = useCallback(() => {
    if (deletedMessage) {
      setAgentHistories(prev => ({
        ...prev,
        [deletedMessage.agent]: [...prev[deletedMessage.agent], deletedMessage.message]
      }));
      setShowUndoToast(false);
      setDeletedMessage(null);
    }
  }, [deletedMessage]);

  // Rerun a user message (resend it)
  const rerunMessage = useCallback(async (messageId: string) => {
    const message = agentHistories[activeAgent].find(msg => msg.id === messageId);
    if (message && message.role === 'user') {
      setInput(message.content);
      // Small delay to ensure state is updated
      setTimeout(() => {
        handleSendMessage();
      }, 100);
    }
  }, [activeAgent, agentHistories, setInput, handleSendMessage]);

  // Clear all messages (new session)
  const clearAllMessages = useCallback(() => {
    const initialHistories = {} as Record<AgentMode, Message[]>;
    Object.values(AgentMode).forEach(mode => {
      initialHistories[mode] = mode === AgentMode.CHAT ? [{
        id: 'init',
        role: 'system',
        content: 'NEXUSFLOW CORE ONLINE. PROJECT FOLDER INITIALIZED.',
        timestamp: Date.now(),
        agent: AgentMode.CHAT
      }] : [];
    });
    setAgentHistories(initialHistories);
    
    // Clear from IndexedDB
    Object.values(AgentMode).forEach(mode => {
      clearMessages(mode).catch(console.error);
    });
  }, []);

  return {
    input,
    setInput,
    agentHistories,
    isProcessing,
    pendingSwitch,
    setPendingSwitch,
    handleSendMessage,
    deleteMessage,
    undoDelete,
    showUndoToast,
    rerunMessage,
    clearAllMessages
  };
};
