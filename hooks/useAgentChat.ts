import { useState, useCallback, useRef } from 'react';
import { AGENTS, AgentMode, Message, ToolState, Task, AppSettings, VirtualFile } from '../types';
import { sendMessageToAgent } from '../services/aiService';

interface UseAgentChatProps {
  activeAgent: AgentMode;
  toolState: ToolState;
  settings: AppSettings;
  tasks: Task[];
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
  rerunMessage: (messageId: string) => void;
}

// Helper to infer agent from task title
const inferAgentForTask = (title: string): AgentMode => {
  const lower = title.toLowerCase();
  if (lower.includes('test') || lower.includes('verify')) return AgentMode.TEST;
  if (lower.includes('deploy') || lower.includes('docker') || lower.includes('ci/cd')) return AgentMode.DEPLOY;
  if (lower.includes('design') || lower.includes('architecture')) return AgentMode.ARCHITECT;
  if (lower.includes('monitor') || lower.includes('log')) return AgentMode.MONITOR;
  if (lower.includes('secure') || lower.includes('auth')) return AgentMode.SECURE;
  return AgentMode.CODER; // Default to Coder
};

export const useAgentChat = ({
  activeAgent,
  toolState,
  settings,
  tasks,
  onTasksUpdate,
  onFilesUpdate
}: UseAgentChatProps): UseAgentChatReturn => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<AgentMode | null>(null);
  const [lastAgentResume, setLastAgentResume] = useState('');
  
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
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const currentInput = input;
    setInput('');
    setIsProcessing(true);
    setPendingSwitch(null);

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

    try {
      // Use the unified AI Service which handles routing to Gemini or Ollama
      const response = await sendMessageToAgent(
          currentInput, 
          agentHistories[activeAgent], 
          activeAgent, 
          toolState, 
          lastAgentResume,
          tasks,
          settings // Pass the full settings object containing provider info
      );

      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        agent: activeAgent,
        grounding: response.sources ? { urls: response.sources } : undefined
      };

      setAgentHistories(prev => ({
        ...prev,
        [activeAgent]: [...prev[activeAgent], agentMsg]
      }));

      // Task Extraction (Only if PLAN agent)
      if (activeAgent === AgentMode.PLAN) {
         extractTasksFromContent(response.text);
      }

      // File Extraction (Coder, Architect, Test, Deploy)
      if ([AgentMode.CODER, AgentMode.ARCHITECT, AgentMode.TEST, AgentMode.DEPLOY].includes(activeAgent)) {
         extractFilesFromContent(response.text);
      }

      // Handle Orchestrator Suggestion
      if (response.suggestedAgent && response.suggestedAgent !== activeAgent) {
        setPendingSwitch(response.suggestedAgent);
      }

    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'ERROR: AGENT CONNECTION INTERRUPTED.',
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
    }
  }, [input, isProcessing, activeAgent, agentHistories, toolState, lastAgentResume, tasks, settings, onTasksUpdate, onFilesUpdate]);

  // Delete a message by ID
  const deleteMessage = useCallback((messageId: string) => {
    setAgentHistories(prev => ({
      ...prev,
      [activeAgent]: prev[activeAgent].filter(msg => msg.id !== messageId)
    }));
  }, [activeAgent]);

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

  return {
    input,
    setInput,
    agentHistories,
    isProcessing,
    pendingSwitch,
    setPendingSwitch,
    handleSendMessage,
    deleteMessage,
    rerunMessage
  };
};
