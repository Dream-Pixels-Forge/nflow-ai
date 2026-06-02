/**
 * Security: Agent-Native Authentication (auth.md)
 * 
 * Implements agent-to-agent authentication and credential management.
 * Based on auth.md specification from Obsidian vault.
 */

export type AuthMethod = 'oauth2' | 'api-key' | 'jwt' | 'mtls' | 'custom';
export type AuthStatus = 'authenticated' | 'unauthenticated' | 'expired' | 'revoked';

export interface AuthCredential {
  id: string;
  agentId: string;
  method: AuthMethod;
  status: AuthStatus;
  
  // Credential data
  token?: string;
  apiKey?: string;
  certificate?: string;
  
  // OAuth2 specific
  accessToken?: string;
  refreshToken?: string;
  tokenEndpoint?: string;
  scopes?: string[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  
  // Usage stats
  usageCount: number;
  maxUsage?: number;
}

export interface AuthChallenge {
  id: string;
  agentId: string;
  method: AuthMethod;
  challenge: string;
  timestamp: string;
  expiresAt: string;
  verified: boolean;
}

export interface AuthSession {
  id: string;
  agentId: string;
  credentialId: string;
  startTime: string;
  lastActivity: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
}

export interface AgentDiscovery {
  agentId: string;
  name: string;
  description: string;
  url: string;
  capabilities: string[];
  authMethods: AuthMethod[];
  authEndpoint: string;
  status: 'online' | 'offline' | 'maintenance';
  lastSeen: string;
  metadata: Record<string, any>;
}

export interface AgentAuthConfig {
  enabled: boolean;
  defaultMethod: AuthMethod;
  tokenExpirationMs: number;
  maxSessionsPerAgent: number;
  requireDiscovery: boolean;
  auditAllAuth: boolean;
}

const DEFAULT_CONFIG: AgentAuthConfig = {
  enabled: true,
  defaultMethod: 'oauth2',
  tokenExpirationMs: 3600000, // 1 hour
  maxSessionsPerAgent: 5,
  requireDiscovery: true,
  auditAllAuth: true
};

/**
 * Agent-Native Authentication System
 */
export class AgentAuth {
  private credentials: Map<string, AuthCredential> = new Map();
  private sessions: Map<string, AuthSession> = new Map();
  private discoveries: Map<string, AgentDiscovery> = new Map();
  private challenges: Map<string, AuthChallenge> = new Map();
  private config: AgentAuthConfig;

  constructor(config: Partial<AgentAuthConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register an agent for discovery
   */
  registerAgent(discovery: Omit<AgentDiscovery, 'lastSeen'>): AgentDiscovery {
    const agent: AgentDiscovery = {
      ...discovery,
      lastSeen: new Date().toISOString()
    };

    this.discoveries.set(agent.agentId, agent);
    return agent;
  }

  /**
   * Discover agents
   */
  discoverAgents(capabilities?: string[]): AgentDiscovery[] {
    let agents = Array.from(this.discoveries.values());

    if (capabilities && capabilities.length > 0) {
      agents = agents.filter(agent =>
        capabilities.some(cap => agent.capabilities.includes(cap))
      );
    }

    return agents.filter(agent => agent.status === 'online');
  }

  /**
   * Get agent discovery info
   */
  getAgentDiscovery(agentId: string): AgentDiscovery | undefined {
    const discovery = this.discoveries.get(agentId);
    if (discovery) {
      discovery.lastSeen = new Date().toISOString();
    }
    return discovery;
  }

  /**
   * Create authentication credential
   */
  createCredential(
    agentId: string,
    method: AuthMethod,
    options?: {
      token?: string;
      apiKey?: string;
      accessToken?: string;
      refreshToken?: string;
      tokenEndpoint?: string;
      scopes?: string[];
      expiresAt?: string;
      maxUsage?: number;
    }
  ): AuthCredential {
    const credential: AuthCredential = {
      id: `cred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      method,
      status: 'authenticated',
      token: options?.token,
      apiKey: options?.apiKey,
      accessToken: options?.accessToken,
      refreshToken: options?.refreshToken,
      tokenEndpoint: options?.tokenEndpoint,
      scopes: options?.scopes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: options?.expiresAt,
      usageCount: 0,
      maxUsage: options?.maxUsage
    };

    this.credentials.set(credential.id, credential);
    return credential;
  }

  /**
   * Authenticate an agent
   */
  authenticate(agentId: string, credentialId: string, metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }): AuthSession | null {
    const credential = this.credentials.get(credentialId);
    if (!credential || credential.agentId !== agentId) {
      return null;
    }

    // Check if credential is valid
    if (credential.status !== 'authenticated') {
      return null;
    }

    // Check expiration
    if (credential.expiresAt && new Date(credential.expiresAt) < new Date()) {
      credential.status = 'expired';
      return null;
    }

    // Check usage limit
    if (credential.maxUsage && credential.usageCount >= credential.maxUsage) {
      credential.status = 'revoked';
      return null;
    }

    // Update usage
    credential.usageCount++;
    credential.lastUsedAt = new Date().toISOString();

    // Check session limit for agent
    const agentSessions = Array.from(this.sessions.values())
      .filter(s => s.agentId === agentId);
    
    if (agentSessions.length >= this.config.maxSessionsPerAgent) {
      // Remove oldest session
      const oldestSession = agentSessions
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
      if (oldestSession) {
        this.sessions.delete(oldestSession.id);
      }
    }

    // Create session
    const session: AuthSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      credentialId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.tokenExpirationMs).toISOString(),
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      metadata: {}
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Validate a session
   */
  validateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(sessionId);
      return false;
    }

    // Update last activity
    session.lastActivity = new Date().toISOString();
    return true;
  }

  /**
   * Terminate a session
   */
  terminateSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Terminate all sessions for an agent
   */
  terminateAgentSessions(agentId: string): number {
    let terminated = 0;

    this.sessions.forEach((session, id) => {
      if (session.agentId === agentId) {
        this.sessions.delete(id);
        terminated++;
      }
    });

    return terminated;
  }

  /**
   * Revoke a credential
   */
  revokeCredential(credentialId: string): boolean {
    const credential = this.credentials.get(credentialId);
    if (!credential) return false;

    credential.status = 'revoked';
    credential.updatedAt = new Date().toISOString();

    // Terminate all sessions using this credential
    this.sessions.forEach((session, id) => {
      if (session.credentialId === credentialId) {
        this.sessions.delete(id);
      }
    });

    return true;
  }

  /**
   * Create an authentication challenge
   */
  createChallenge(agentId: string, method: AuthMethod): AuthChallenge {
    const challenge: AuthChallenge = {
      id: `challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      method,
      challenge: this.generateChallenge(method),
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes
      verified: false
    };

    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  /**
   * Verify an authentication challenge
   */
  verifyChallenge(challengeId: string, response: string): boolean {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return false;

    // Check expiration
    if (new Date(challenge.expiresAt) < new Date()) {
      this.challenges.delete(challengeId);
      return false;
    }

    // Verify response (simplified - in production, use proper crypto)
    const verified = response === challenge.challenge;
    challenge.verified = verified;

    if (verified) {
      this.challenges.delete(challengeId);
    }

    return verified;
  }

  /**
   * Generate challenge based on method
   */
  private generateChallenge(method: AuthMethod): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${method}:${timestamp}:${random}`;
  }

  /**
   * Get agent sessions
   */
  getAgentSessions(agentId: string): AuthSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.agentId === agentId);
  }

  /**
   Get agent credentials
   */
  getAgentCredentials(agentId: string): AuthCredential[] {
    return Array.from(this.credentials.values())
      .filter(c => c.agentId === agentId);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): AuthSession[] {
    const now = new Date();
    return Array.from(this.sessions.values())
      .filter(s => new Date(s.expiresAt) > now);
  }

  /**
   * Get Agent Auth stats
   */
  getStats(): {
    totalCredentials: number;
    activeCredentials: number;
    totalSessions: number;
    activeSessions: number;
    totalDiscoveries: number;
    onlineAgents: number;
    byMethod: Record<AuthMethod, number>;
  } {
    const credentials = Array.from(this.credentials.values());
    const sessions = Array.from(this.sessions.values());
    const discoveries = Array.from(this.discoveries.values());

    const byMethod: Record<AuthMethod, number> = {
      oauth2: 0,
      'api-key': 0,
      jwt: 0,
      mtls: 0,
      custom: 0
    };

    credentials.forEach(c => byMethod[c.method]++);

    return {
      totalCredentials: credentials.length,
      activeCredentials: credentials.filter(c => c.status === 'authenticated').length,
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => new Date(s.expiresAt) > new Date()).length,
      totalDiscoveries: discoveries.length,
      onlineAgents: discoveries.filter(d => d.status === 'online').length,
      byMethod
    };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<AgentAuthConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get config
   */
  getConfig(): AgentAuthConfig {
    return { ...this.config };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.credentials.clear();
    this.sessions.clear();
    this.discoveries.clear();
    this.challenges.clear();
  }
}

// Singleton instance
export const agentAuth = new AgentAuth();
