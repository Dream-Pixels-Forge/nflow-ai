/**
 * Production: Persistent Services
 * 
 * Implements session, memory, and artifact services for production deployment.
 * Based on ADK Persistent Services from Obsidian vault.
 */

export interface Session {
  id: string;
  userId: string;
  agentId: string;
  state: Map<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  lastAccessed: string;
  accessCount: number;
}

export interface Artifact {
  id: string;
  sessionId: string;
  name: string;
  type: string;
  mimeType: string;
  data: string | Buffer;
  size: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryBankEntry {
  id: string;
  userId: string;
  sessionId?: string;
  type: 'fact' | 'preference' | 'interaction' | 'learning';
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
  importance: number;
  createdAt: string;
  updatedAt: string;
  lastAccessed: string;
  accessCount: number;
}

export interface PersistentServiceConfig {
  sessionTtlMs: number;
  maxSessionsPerUser: number;
  maxArtifactsPerSession: number;
  maxMemoryEntries: number;
  autoCleanup: boolean;
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: PersistentServiceConfig = {
  sessionTtlMs: 3600000, // 1 hour
  maxSessionsPerUser: 10,
  maxArtifactsPerSession: 50,
  maxMemoryEntries: 10000,
  autoCleanup: true,
  cleanupIntervalMs: 300000 // 5 minutes
};

/**
 * Session Service - Manages persistent sessions
 */
export class SessionService {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private config: PersistentServiceConfig;

  constructor(config: Partial<PersistentServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.autoCleanup) {
      this.startCleanupTimer();
    }
  }

  /**
   * Create a new session
   */
  createSession(userId: string, agentId: string, initialState?: Record<string, any>): Session {
    // Check session limit per user
    const userSessionIds = this.userSessions.get(userId) || new Set();
    if (userSessionIds.size >= this.config.maxSessionsPerUser) {
      // Remove oldest session
      const oldestSessionId = Array.from(userSessionIds)
        .map(id => this.sessions.get(id))
        .filter((s): s is Session => s !== undefined)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]?.id;
      
      if (oldestSessionId) {
        this.deleteSession(oldestSessionId);
      }
    }

    const session: Session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      agentId,
      state: new Map(Object.entries(initialState || {})),
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.sessionTtlMs).toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 0
    };

    this.sessions.set(session.id, session);
    
    // Update user sessions index
    const userSessions = this.userSessions.get(userId) || new Set();
    userSessions.add(session.id);
    this.userSessions.set(userId, userSessions);

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessed = new Date().toISOString();
      session.accessCount++;
    }
    return session;
  }

  /**
   * Update session state
   */
  updateSessionState(sessionId: string, state: Record<string, any>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    Object.entries(state).forEach(([key, value]) => {
      session.state.set(key, value);
    });

    session.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Get session state
   */
  getSessionState(sessionId: string): Record<string, any> | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const state: Record<string, any> = {};
    session.state.forEach((value, key) => {
      state[key] = value;
    });
    return state;
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Remove from user sessions index
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
    }

    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): Session[] {
    const sessionIds = this.userSessions.get(userId) || new Set();
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter((s): s is Session => s !== undefined);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): Session[] {
    const now = Date.now();
    return Array.from(this.sessions.values()).filter(s => 
      !s.expiresAt || new Date(s.expiresAt).getTime() > now
    );
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Cleanup expired sessions
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    this.sessions.forEach((session, id) => {
      if (session.expiresAt && new Date(session.expiresAt).getTime() < now) {
        this.deleteSession(id);
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Get stats
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    averageAccessCount: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();
    const active = sessions.filter(s => !s.expiresAt || new Date(s.expiresAt).getTime() > now);
    const expired = sessions.filter(s => s.expiresAt && new Date(s.expiresAt).getTime() <= now);

    const totalAccessCount = sessions.reduce((sum, s) => sum + s.accessCount, 0);

    return {
      totalSessions: sessions.length,
      activeSessions: active.length,
      expiredSessions: expired.length,
      averageAccessCount: sessions.length > 0 ? totalAccessCount / sessions.length : 0
    };
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessions.clear();
    this.userSessions.clear();
  }
}

/**
 * Artifact Service - Manages persistent artifacts
 */
export class ArtifactService {
  private artifacts: Map<string, Artifact> = new Map();
  private sessionArtifacts: Map<string, Set<string>> = new Map();
  private config: PersistentServiceConfig;

  constructor(config: Partial<PersistentServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Store an artifact
   */
  storeArtifact(
    sessionId: string,
    name: string,
    type: string,
    mimeType: string,
    data: string | Buffer,
    metadata: Record<string, any> = {}
  ): Artifact {
    // Check artifact limit per session
    const sessionArtifactIds = this.sessionArtifacts.get(sessionId) || new Set();
    if (sessionArtifactIds.size >= this.config.maxArtifactsPerSession) {
      // Remove oldest artifact
      const oldestArtifactId = Array.from(sessionArtifactIds)
        .map(id => this.artifacts.get(id))
        .filter((a): a is Artifact => a !== undefined)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]?.id;
      
      if (oldestArtifactId) {
        this.deleteArtifact(oldestArtifactId);
      }
    }

    const artifact: Artifact = {
      id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      name,
      type,
      mimeType,
      data,
      size: typeof data === 'string' ? data.length : data.length,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.artifacts.set(artifact.id, artifact);

    // Update session artifacts index
    const sessionArtifacts = this.sessionArtifacts.get(sessionId) || new Set();
    sessionArtifacts.add(artifact.id);
    this.sessionArtifacts.set(sessionId, sessionArtifacts);

    return artifact;
  }

  /**
   * Get artifact by ID
   */
  getArtifact(artifactId: string): Artifact | undefined {
    return this.artifacts.get(artifactId);
  }

  /**
   * Get all artifacts for a session
   */
  getSessionArtifacts(sessionId: string): Artifact[] {
    const artifactIds = this.sessionArtifacts.get(sessionId) || new Set();
    return Array.from(artifactIds)
      .map(id => this.artifacts.get(id))
      .filter((a): a is Artifact => a !== undefined);
  }

  /**
   * Delete artifact
   */
  deleteArtifact(artifactId: string): boolean {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) return false;

    // Remove from session artifacts index
    const sessionArtifacts = this.sessionArtifacts.get(artifact.sessionId);
    if (sessionArtifacts) {
      sessionArtifacts.delete(artifactId);
    }

    this.artifacts.delete(artifactId);
    return true;
  }

  /**
   * Get artifacts by type
   */
  getArtifactsByType(type: string): Artifact[] {
    return Array.from(this.artifacts.values()).filter(a => a.type === type);
  }

  /**
   * Get stats
   */
  getStats(): {
    totalArtifacts: number;
    totalSize: number;
    byType: Record<string, number>;
    byMimeType: Record<string, number>;
  } {
    const artifacts = Array.from(this.artifacts.values());
    const totalSize = artifacts.reduce((sum, a) => sum + a.size, 0);

    const byType: Record<string, number> = {};
    const byMimeType: Record<string, number> = {};

    artifacts.forEach(a => {
      byType[a.type] = (byType[a.type] || 0) + 1;
      byMimeType[a.mimeType] = (byMimeType[a.mimeType] || 0) + 1;
    });

    return {
      totalArtifacts: artifacts.length,
      totalSize,
      byType,
      byMimeType
    };
  }

  /**
   * Clear all artifacts
   */
  clear(): void {
    this.artifacts.clear();
    this.sessionArtifacts.clear();
  }
}

/**
 * Memory Bank - Long-term memory storage
 */
export class MemoryBank {
  private entries: Map<string, MemoryBankEntry> = new Map();
  private userEntries: Map<string, Set<string>> = new Map();
  private config: PersistentServiceConfig;

  constructor(config: Partial<PersistentServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a memory entry
   */
  addMemory(
    userId: string,
    type: MemoryBankEntry['type'],
    content: string,
    metadata: Record<string, any> = {},
    importance: number = 0.5,
    sessionId?: string
  ): MemoryBankEntry {
    // Check memory limit per user
    const userEntryIds = this.userEntries.get(userId) || new Set();
    if (userEntryIds.size >= this.config.maxMemoryEntries) {
      // Remove least important entry
      const leastImportant = Array.from(userEntryIds)
        .map(id => this.entries.get(id))
        .filter((e): e is MemoryBankEntry => e !== undefined)
        .sort((a, b) => a.importance - b.importance)[0];
      
      if (leastImportant) {
        this.deleteMemory(leastImportant.id);
      }
    }

    const entry: MemoryBankEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      sessionId,
      type,
      content,
      metadata,
      importance,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 0
    };

    this.entries.set(entry.id, entry);

    // Update user entries index
    const userEntryIds2 = this.userEntries.get(userId) || new Set();
    userEntryIds2.add(entry.id);
    this.userEntries.set(userId, userEntryIds2);

    return entry;
  }

  /**
   * Get memory entry by ID
   */
  getMemory(memoryId: string): MemoryBankEntry | undefined {
    const entry = this.entries.get(memoryId);
    if (entry) {
      entry.lastAccessed = new Date().toISOString();
      entry.accessCount++;
    }
    return entry;
  }

  /**
   * Search memories
   */
  searchMemories(userId: string, query: string, limit: number = 10): MemoryBankEntry[] {
    const userEntryIds = this.userEntries.get(userId) || new Set();
    const lowerQuery = query.toLowerCase();

    return Array.from(userEntryIds)
      .map(id => this.entries.get(id))
      .filter((e): e is MemoryBankEntry => e !== undefined)
      .filter(e => e.content.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  /**
   * Get recent memories
   */
  getRecentMemories(userId: string, limit: number = 10): MemoryBankEntry[] {
    const userEntryIds = this.userEntries.get(userId) || new Set();

    return Array.from(userEntryIds)
      .map(id => this.entries.get(id))
      .filter((e): e is MemoryBankEntry => e !== undefined)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Delete memory
   */
  deleteMemory(memoryId: string): boolean {
    const entry = this.entries.get(memoryId);
    if (!entry) return false;

    // Remove from user entries index
    const userEntryIds = this.userEntries.get(entry.userId);
    if (userEntryIds) {
      userEntryIds.delete(memoryId);
    }

    this.entries.delete(memoryId);
    return true;
  }

  /**
   * Get stats
   */
  getStats(): {
    totalEntries: number;
    byType: Record<string, number>;
    averageImportance: number;
    totalAccessCount: number;
  } {
    const entries = Array.from(this.entries.values());
    const byType: Record<string, number> = {};

    entries.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
    });

    const totalImportance = entries.reduce((sum, e) => sum + e.importance, 0);
    const totalAccessCount = entries.reduce((sum, e) => sum + e.accessCount, 0);

    return {
      totalEntries: entries.length,
      byType,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
      totalAccessCount
    };
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.entries.clear();
    this.userEntries.clear();
  }
}

// Singleton instances
export const sessionService = new SessionService();
export const artifactService = new ArtifactService();
export const memoryBank = new MemoryBank();
