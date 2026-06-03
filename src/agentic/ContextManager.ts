/**
 * ContextManager - Session isolation and context window optimization
 * 
 * Implements context management, session isolation, and MCP gate control
 * Based on context engineering principles from Obsidian vault knowledge.
 */

export type ContextStatus = 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'OVERFLOW';

export interface ContextSession {
  id: string;
  agentId: string;
  createdAt: number;
  lastAccessed: number;
  tokenCount: number;
  maxTokens: number;
  status: ContextStatus;
  mcpServers: MCPServerState[];
  memoryFiles: string[];
  conversationHistory: ConversationMessage[];
}

export interface MCPServerState {
  name: string;
  enabled: boolean;
  tokenCost: number;
  lastUsed: number;
  tools: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount: number;
  timestamp: number;
}

export interface ContextConfig {
  enabled: boolean;
  maxTokensPerSession: number;
  warningThreshold: number; // percentage (0.5 = 50%)
  criticalThreshold: number; // percentage (0.8 = 80%)
  autoCompress: boolean;
  compressThreshold: number; // percentage (0.7 = 70%)
  sessionTimeoutMs: number;
  maxSessions: number;
}

const DEFAULT_CONFIG: ContextConfig = {
  enabled: true,
  maxTokensPerSession: 100000,
  warningThreshold: 0.5,
  criticalThreshold: 0.8,
  autoCompress: true,
  compressThreshold: 0.7,
  sessionTimeoutMs: 1800000, // 30 minutes
  maxSessions: 10
};

export class ContextManager {
  private sessions: Map<string, ContextSession> = new Map();
  private config: ContextConfig;
  private onStatusCallback?: (sessionId: string, status: ContextStatus) => void;
  private onCompressCallback?: (sessionId: string,压缩前: number, 压缩后: number) => void;

  constructor(config: Partial<ContextConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Register callbacks
   */
  onStatus(callback: (sessionId: string, status: ContextStatus) => void): void {
    this.onStatusCallback = callback;
  }

  onCompress(callback: (sessionId: string, before: number, after: number) => void): void {
    this.onCompressCallback = callback;
  }

  /**
   * Create a new context session
   */
  createSession(agentId: string, maxTokens?: number): ContextSession {
    // Check session limit
    if (this.sessions.size >= this.config.maxSessions) {
      // Remove oldest session
      const oldest = Array.from(this.sessions.values())
        .sort((a, b) => a.lastAccessed - b.lastAccessed)[0];
      if (oldest) {
        this.sessions.delete(oldest.id);
      }
    }

    const session: ContextSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      tokenCount: 0,
      maxTokens: maxTokens || this.config.maxTokensPerSession,
      status: 'OPTIMAL',
      mcpServers: [],
      memoryFiles: [],
      conversationHistory: []
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ContextSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get sessions for an agent
   */
  getAgentSessions(agentId: string): ContextSession[] {
    return Array.from(this.sessions.values()).filter(s => s.agentId === agentId);
  }

  /**
   * Add message to session
   */
  addMessage(sessionId: string, message: Omit<ConversationMessage, 'tokenCount' | 'timestamp'>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Estimate token count (rough approximation: 1 token ≈ 4 chars)
    const tokenCount = Math.ceil(message.content.length / 4);

    const fullMessage: ConversationMessage = {
      ...message,
      tokenCount,
      timestamp: Date.now()
    };

    session.conversationHistory.push(fullMessage);
    session.tokenCount += tokenCount;
    session.lastAccessed = Date.now();

    // Update status
    this.updateSessionStatus(session);

    // Auto-compress if enabled and threshold reached
    if (this.config.autoCompress && session.status === 'CRITICAL') {
      this.compressSession(sessionId);
    }

    return true;
  }

  /**
   * Update session status based on token usage
   */
  private updateSessionStatus(session: ContextSession): void {
    const usageRatio = session.tokenCount / session.maxTokens;

    if (usageRatio >= this.config.criticalThreshold) {
      session.status = 'CRITICAL';
    } else if (usageRatio >= this.config.warningThreshold) {
      session.status = 'WARNING';
    } else {
      session.status = 'OPTIMAL';
    }

    // Check for overflow
    if (session.tokenCount > session.maxTokens) {
      session.status = 'OVERFLOW';
    }

    // Emit status callback
    if (this.onStatusCallback) {
      this.onStatusCallback(session.id, session.status);
    }
  }

  /**
   * Compress session context by summarizing old messages
   */
  compressSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const beforeCount = session.tokenCount;
    const beforeMessages = session.conversationHistory.length;

    // Keep last 6 messages intact, summarize the rest
    if (session.conversationHistory.length > 6) {
      const toSummarize = session.conversationHistory.splice(0, session.conversationHistory.length - 6);
      const removedTokens = toSummarize.reduce((sum, msg) => sum + msg.tokenCount, 0);

      // Create a summary of removed messages
      const summaryParts = toSummarize.map(msg => {
        const truncated = msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content;
        return `[${msg.role}]: ${truncated}`;
      });

      const summary: ConversationMessage = {
        role: 'system',
        content: `[Context Summary - ${beforeMessages} messages compressed] ${summaryParts.join(' | ')}`,
        tokenCount: Math.ceil(summaryParts.join(' | ').length / 4),
        timestamp: Date.now()
      };

      session.conversationHistory.unshift(summary);
      session.tokenCount = session.conversationHistory.reduce((sum, msg) => sum + msg.tokenCount, 0);
    }

    // Update status
    this.updateSessionStatus(session);

    // Emit compress callback
    if (this.onCompressCallback) {
      this.onCompressCallback(sessionId, beforeCount, session.tokenCount);
    }

    return true;
  }

  /**
   * Enable/disable MCP server for session
   */
  toggleMCPServer(sessionId: string, serverName: string, enabled: boolean): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const server = session.mcpServers.find(s => s.name === serverName);
    if (server) {
      server.enabled = enabled;
      server.lastUsed = Date.now();
    } else {
      session.mcpServers.push({
        name: serverName,
        enabled,
        tokenCost: 0,
        lastUsed: Date.now(),
        tools: []
      });
    }

    return true;
  }

  /**
   * Get enabled MCP servers for session
   */
  getEnabledMCPServers(sessionId: string): MCPServerState[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.mcpServers.filter(s => s.enabled);
  }

  /**
   * Add memory file to session
   */
  addMemoryFile(sessionId: string, filePath: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (!session.memoryFiles.includes(filePath)) {
      session.memoryFiles.push(filePath);
    }

    return true;
  }

  /**
   * Remove memory file from session
   */
  removeMemoryFile(sessionId: string, filePath: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const index = session.memoryFiles.indexOf(filePath);
    if (index > -1) {
      session.memoryFiles.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Get context usage statistics
   */
  getContextStats(sessionId: string): {
    tokenCount: number;
    maxTokens: number;
    usagePercentage: number;
    messageCount: number;
    mcpServerCount: number;
    memoryFileCount: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      tokenCount: session.tokenCount,
      maxTokens: session.maxTokens,
      usagePercentage: (session.tokenCount / session.maxTokens) * 100,
      messageCount: session.conversationHistory.length,
      mcpServerCount: session.mcpServers.filter(s => s.enabled).length,
      memoryFileCount: session.memoryFiles.length
    };
  }

  /**
   * Start cleanup timer for expired sessions
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      this.sessions.forEach((session, id) => {
        if (now - session.lastAccessed > this.config.sessionTimeoutMs) {
          this.sessions.delete(id);
        }
      });
    }, 60000); // Check every minute
  }

  /**
   * Clear session
   */
  clearSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ContextSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextConfig {
    return { ...this.config };
  }

  /**
   * Cleanup context manager
   */
  destroy(): void {
    this.sessions.clear();
  }
}

// Singleton instance
export const contextManager = new ContextManager();
