
export enum AgentMode {
  CHAT = 'CHAT',
  CODER = 'CODER',
  ARCHITECT = 'ARCHITECT',
  PLAN = 'PLAN',
  TEST = 'TEST',
  SECURE = 'SECURE',
  DEPLOY = 'DEPLOY',
  MONITOR = 'MONITOR'
}

export interface AgentConfig {
  id: AgentMode;
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agent: AgentMode;
  isError?: boolean;
  isStreaming?: boolean;
  grounding?: {
    urls: string[];
  };
}

export interface Task {
  id: string;
  title: string;
  status: 'idle' | 'in-progress' | 'review' | 'done';
  agent: AgentMode; // The agent best suited for this task
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  network: number;
  tasks: number;
}

export type SuggestionLevel = 'low' | 'medium' | 'high';
export type AIProvider = 'gemini' | 'ollama' | 'openrouter' | 'nvidia' | 'opencode';

export interface AppSettings {
  suggestionLevel: SuggestionLevel;
  soundEnabled: boolean;
  autoScroll: boolean;
  animations: boolean;
  // Backend Settings
  aiProvider: AIProvider;
  // Gemini Settings
  geminiApiKey?: string;
  // Ollama Settings
  ollamaUrl: string;
  ollamaGeneralModel: string;
  ollamaCodingModel: string;
  // OpenRouter Settings
  openrouterApiKey?: string;
  openrouterModel?: string;
  // NVIDIA Settings
  nvidiaApiKey?: string;
  nvidiaModel?: string;
  nvidiaBaseUrl?: string;
  // OpenCode Settings
  opencodeApiKey?: string;
  opencodeModel?: string;
  opencodeBaseUrl?: string;
}

// New Tool Interfaces
export interface ToolState {
  mcp: { active: boolean; port: string };
  rag: { active: boolean; content: string[] }; // Stores loaded text snippets
  fetch: { active: boolean; targetUrl: string };
  doc: { active: boolean; files: string[] }; // Stores file names
}

// Virtual File System Types
export interface VirtualFile {
  name: string;
  content: string;
  language: string;
  status: 'unmodified' | 'modified' | 'new';
}

export interface GitState {
  branch: string;
  commitHistory: { id: string; message: string; timestamp: number }[];
  pendingChanges: VirtualFile[];
}

export const AGENTS: Record<AgentMode, AgentConfig> = {
  [AgentMode.CHAT]: { id: AgentMode.CHAT, name: 'NEXUS-CHAT', description: 'General Assistant & Coordinator', color: 'text-gray-300', icon: 'MessageSquare' },
  [AgentMode.PLAN]: { id: AgentMode.PLAN, name: 'NEXUS-PLAN', description: 'Requirements & User Stories', color: 'text-blue-400', icon: 'Map' },
  [AgentMode.ARCHITECT]: { id: AgentMode.ARCHITECT, name: 'NEXUS-ARCH', description: 'System Design & Structure', color: 'text-purple-400', icon: 'Cpu' },
  [AgentMode.CODER]: { id: AgentMode.CODER, name: 'NEXUS-CODE', description: 'Implementation Specialist', color: 'text-cyan-400', icon: 'Code' },
  [AgentMode.TEST]: { id: AgentMode.TEST, name: 'NEXUS-TEST', description: 'QA & Validation', color: 'text-yellow-400', icon: 'FlaskConical' },
  [AgentMode.SECURE]: { id: AgentMode.SECURE, name: 'NEXUS-SEC', description: 'Security & Vulnerability Analysis', color: 'text-red-500', icon: 'ShieldAlert' },
  [AgentMode.DEPLOY]: { id: AgentMode.DEPLOY, name: 'NEXUS-OPS', description: 'CI/CD & Deployment', color: 'text-orange-400', icon: 'Rocket' },
  [AgentMode.MONITOR]: { id: AgentMode.MONITOR, name: 'NEXUS-MON', description: 'Performance & Health', color: 'text-emerald-500', icon: 'Activity' },
};

// Provider Display Names
export const PROVIDER_NAMES: Record<AIProvider, string> = {
  gemini: 'Google Gemini',
  ollama: 'Ollama (Local)',
  openrouter: 'OpenRouter',
  nvidia: 'NVIDIA NIM',
  opencode: 'OpenCode'
};

// Provider Descriptions
export const PROVIDER_DESCRIPTIONS: Record<AIProvider, string> = {
  gemini: 'Google Cloud AI with grounding and search capabilities',
  ollama: 'Local inference with open-source models',
  openrouter: 'Access to 100+ models via unified API',
  nvidia: 'NVIDIA inference microservices for enterprise AI',
  opencode: 'Open-source AI coding assistant'
};
