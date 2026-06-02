/**
 * A2A Protocol - Agent Cards
 * 
 * Implements Agent Card discovery and capability negotiation
 * Based on A2A Protocol specification from Obsidian vault.
 */

export interface AgentCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  maxConcurrentTasks: number;
}

export interface AgentAuthentication {
  type: 'none' | 'api-key' | 'oauth2' | 'mtls';
  scopes?: string[];
  tokenUrl?: string;
  issuer?: string;
}

export interface AgentEndpoints {
  tasks: string;
  sse: string;
  health: string;
}

export interface AgentCard {
  name: string;
  version: string;
  description: string;
  url: string;
  capabilities: AgentCapability[];
  authentication: AgentAuthentication;
  endpoints: AgentEndpoints;
  supportedModalities: ('text' | 'code' | 'binary' | 'image' | 'audio')[];
  maxTokens: number;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  metadata: {
    author: string;
    license: string;
    repository?: string;
    documentation?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AgentCardRegistry {
  agents: Map<string, AgentCard>;
  lastUpdated: string;
}

/**
 * Agent Card Manager - Handles agent discovery and registration
 */
export class AgentCardManager {
  private registry: AgentCardRegistry;
  private wellKnownPath = '/.well-known/agent.json';

  constructor() {
    this.registry = {
      agents: new Map(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Create an Agent Card for a local agent
   */
  createAgentCard(config: {
    name: string;
    version: string;
    description: string;
    url: string;
    capabilities: AgentCapability[];
    authentication?: AgentAuthentication;
    supportedModalities?: string[];
    maxTokens?: number;
    rateLimit?: { requestsPerMinute: number; tokensPerMinute: number };
    metadata?: { author: string; license: string; repository?: string; documentation?: string };
  }): AgentCard {
    const card: AgentCard = {
      name: config.name,
      version: config.version,
      description: config.description,
      url: config.url,
      capabilities: config.capabilities,
      authentication: config.authentication || { type: 'none' },
      endpoints: {
        tasks: `${config.url}/tasks`,
        sse: `${config.url}/sse`,
        health: `${config.url}/health`
      },
      supportedModalities: (config.supportedModalities as any) || ['text', 'code'],
      maxTokens: config.maxTokens || 100000,
      rateLimit: config.rateLimit || {
        requestsPerMinute: 60,
        tokensPerMinute: 100000
      },
      metadata: config.metadata || {
        author: 'NexusFlow',
        license: 'MIT'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.registry.agents.set(config.name, card);
    this.registry.lastUpdated = new Date().toISOString();

    return card;
  }

  /**
   * Register an agent card from a remote source
   */
  registerAgent(card: AgentCard): void {
    this.registry.agents.set(card.name, card);
    this.registry.lastUpdated = new Date().toISOString();
  }

  /**
   * Discover agents by capability
   */
  discoverByCapability(capabilityName: string): AgentCard[] {
    return Array.from(this.registry.agents.values()).filter(card =>
      card.capabilities.some(cap => cap.name === capabilityName)
    );
  }

  /**
   * Discover agents by modality
   */
  discoverByModality(modality: 'text' | 'code' | 'binary' | 'image' | 'audio'): AgentCard[] {
    return Array.from(this.registry.agents.values()).filter(card =>
      card.supportedModalities.includes(modality)
    );
  }

  /**
   * Negotiate capabilities with a remote agent
   */
  async negotiateCapabilities(
    remoteAgentUrl: string,
    requiredCapabilities: string[],
    requiredModalities: string[]
  ): Promise<{
    compatible: boolean;
    agentCard: AgentCard | null;
    missingCapabilities: string[];
    missingModalities: string[];
  }> {
    try {
      // Fetch remote agent card
      const response = await fetch(`${remoteAgentUrl}${this.wellKnownPath}`);
      if (!response.ok) {
        return {
          compatible: false,
          agentCard: null,
          missingCapabilities: requiredCapabilities,
          missingModalities: requiredModalities
        };
      }

      const agentCard: AgentCard = await response.json();

      // Check capabilities
      const agentCapabilityNames = agentCard.capabilities.map(c => c.name);
      const missingCapabilities = requiredCapabilities.filter(
        cap => !agentCapabilityNames.includes(cap)
      );

      // Check modalities
      const missingModalities = requiredModalities.filter(
        mod => !agentCard.supportedModalities.includes(mod as any)
      );

      return {
        compatible: missingCapabilities.length === 0 && missingModalities.length === 0,
        agentCard,
        missingCapabilities,
        missingModalities
      };
    } catch (error) {
      console.error('[A2A] Failed to negotiate capabilities:', error);
      return {
        compatible: false,
        agentCard: null,
        missingCapabilities: requiredCapabilities,
        missingModalities: requiredModalities
      };
    }
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): AgentCard[] {
    return Array.from(this.registry.agents.values());
  }

  /**
   * Get agent card by name
   */
  getAgentCard(name: string): AgentCard | undefined {
    return this.registry.agents.get(name);
  }

  /**
   * Update agent card
   */
  updateAgentCard(name: string, updates: Partial<AgentCard>): boolean {
    const existing = this.registry.agents.get(name);
    if (!existing) return false;

    const updated: AgentCard = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.registry.agents.set(name, updated);
    this.registry.lastUpdated = new Date().toISOString();

    return true;
  }

  /**
   * Remove agent card
   */
  removeAgentCard(name: string): boolean {
    const deleted = this.registry.agents.delete(name);
    if (deleted) {
      this.registry.lastUpdated = new Date().toISOString();
    }
    return deleted;
  }

  /**
   * Export registry as JSON (for /.well-known/agent.json)
   */
  exportRegistry(): object {
    return {
      agents: Array.from(this.registry.agents.values()),
      lastUpdated: this.registry.lastUpdated
    };
  }

  /**
   * Get registry stats
   */
  getStats(): {
    totalAgents: number;
    capabilities: string[];
    modalities: string[];
  } {
    const agents = Array.from(this.registry.agents.values());
    
    const capabilities = [...new Set(
      agents.flatMap(a => a.capabilities.map(c => c.name))
    )];

    const modalities = [...new Set(
      agents.flatMap(a => a.supportedModalities)
    )];

    return {
      totalAgents: agents.length,
      capabilities,
      modalities
    };
  }
}

// Singleton instance
export const agentCardManager = new AgentCardManager();
