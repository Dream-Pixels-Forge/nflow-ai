/**
 * Agent OS Orchestrator
 * 
 * Central coordinator for the 7-Layer Personal Agent OS.
 * Based on Personal Agent OS from Obsidian vault.
 */

import { identityManager, UserIdentity, IdentityRule } from './IdentitySystem';
import { contextPortfolioManager, ContextEntry, ContextCategory } from './ContextPortfolio';
import { skillsLibrary, Skill, SkillCategory, SkillExecution } from './SkillsLibrary';
import { memoryManager, MemoryEntry, MemoryType } from '../memory/MemoryManager';
import { mcpManager, MCPServer, MCPTool } from '../mcp/MCPManager';

export interface AgentOSConfig {
  enableIdentity: boolean;
  enableContext: boolean;
  enableSkills: boolean;
  enableMemory: boolean;
  enableConnections: boolean;
  enableVerification: boolean;
  enableAutomation: boolean;
}

export interface AgentOSState {
  identity: UserIdentity | null;
  contextStats: {
    totalEntries: number;
    byCategory: Record<ContextCategory, number>;
  };
  skillsStats: {
    totalSkills: number;
    totalExecutions: number;
  };
  memoryStats: {
    totalEntries: number;
    totalAccessCount: number;
  };
  connectionStats: {
    totalServers: number;
    connectedServers: number;
  };
}

export interface VerificationResult {
  valid: boolean;
  violations: IdentityRule[];
  warnings: IdentityRule[];
  suggestions: string[];
}

/**
 * AgentOS - Central coordinator for the 7-Layer Personal Agent OS
 */
export class AgentOS {
  private config: AgentOSConfig;
  private initialized = false;

  constructor(config: Partial<AgentOSConfig> = {}) {
    this.config = {
      enableIdentity: true,
      enableContext: true,
      enableSkills: true,
      enableMemory: true,
      enableConnections: true,
      enableVerification: true,
      enableAutomation: true,
      ...config
    };
  }

  /**
   * Initialize the Agent OS
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load subsystems if enabled (no-op guards in place)
    // Identity, context, skills, memory, connections are lazily initialized

    this.initialized = true;
  }

  // ==================== Layer 1: Identity ====================

  /**
   * Set user identity
   */
  setIdentity(identity: Partial<UserIdentity>): UserIdentity {
    return identityManager.setIdentity(identity);
  }

  /**
   * Get user identity
   */
  getIdentity(): UserIdentity | null {
    return identityManager.getIdentity();
  }

  /**
   * Load identity from template
   */
  loadIdentityTemplate(templateName: string): UserIdentity | null {
    return identityManager.loadTemplate(templateName);
  }

  /**
   * Add identity rule
   */
  addIdentityRule(rule: Omit<IdentityRule, 'id'>): IdentityRule | null {
    return identityManager.addRule(rule);
  }

  /**
   * Validate action against identity rules
   */
  validateAction(action: string, context?: Record<string, any>): VerificationResult {
    const validation = identityManager.validateAction(action, context);

    return {
      ...validation,
      suggestions: this.generateSuggestions(validation)
    };
  }

  /**
   * Generate suggestions based on validation
   */
  private generateSuggestions(validation: { violations: IdentityRule[]; warnings: IdentityRule[] }): string[] {
    const suggestions: string[] = [];

    validation.violations.forEach(violation => {
      switch (violation.category) {
        case 'approval':
          suggestions.push(`Get approval before proceeding: ${violation.rule}`);
          break;
        case 'security':
          suggestions.push(`Security concern: ${violation.rule}`);
          break;
        case 'quality':
          suggestions.push(`Quality requirement: ${violation.rule}`);
          break;
      }
    });

    validation.warnings.forEach(warning => {
      suggestions.push(`Consider: ${warning.rule}`);
    });

    return suggestions;
  }

  // ==================== Layer 2: Context ====================

  /**
   * Add context entry
   */
  addContext(entry: Omit<ContextEntry, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessed' | 'accessCount'>): ContextEntry {
    return contextPortfolioManager.addEntry(entry);
  }

  /**
   * Get context entries by category
   */
  getContextByCategory(category: ContextCategory): ContextEntry[] {
    return contextPortfolioManager.getEntriesByCategory(category);
  }

  /**
   * Search context
   */
  searchContext(query: string): ContextEntry[] {
    return contextPortfolioManager.searchEntries(query);
  }

  /**
   * Export context as markdown
   */
  exportContextAsMarkdown(): string {
    return contextPortfolioManager.exportAsMarkdown();
  }

  // ==================== Layer 3: Skills ====================

  /**
   * Add skill
   */
  addSkill(skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'averageRating' | 'ratings'>): Skill {
    return skillsLibrary.addSkill(skill);
  }

  /**
   * Find skill by trigger
   */
  findSkillByTrigger(trigger: string): Skill | undefined {
    return skillsLibrary.findByTrigger(trigger);
  }

  /**
   * Execute skill
   */
  executeSkill(skillId: string, parameters: Record<string, any>, input: string): SkillExecution {
    return skillsLibrary.executeSkill(skillId, parameters, input);
  }

  /**
   * Get popular skills
   */
  getPopularSkills(limit?: number): Skill[] {
    return skillsLibrary.getPopularSkills(limit);
  }

  // ==================== Layer 4: Memory ====================

  /**
   * Add memory
   */
  addMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessedAt' | 'accessCount'>): MemoryEntry {
    return memoryManager.addMemory(entry);
  }

  /**
   * Add decision memory
   */
  addDecision(content: string, tags: string[] = [], importance: MemoryEntry['importance'] = 'medium'): MemoryEntry {
    return memoryManager.addMemory({
      type: 'decision',
      content,
      tags,
      importance,
      metadata: {},
      relatedEntries: []
    });
  }

  /**
   * Add learning memory
   */
  addLearning(content: string, tags: string[] = [], importance: MemoryEntry['importance'] = 'medium'): MemoryEntry {
    return memoryManager.addMemory({
      type: 'learning',
      content,
      tags,
      importance,
      metadata: {},
      relatedEntries: []
    });
  }

  /**
   * Search memory
   */
  searchMemory(query: string): MemoryEntry[] {
    return memoryManager.searchMemories({ search: query });
  }

  // ==================== Layer 5: Connections ====================

  /**
   * Register MCP server
   */
  registerMCPServer(server: Omit<MCPServer, 'status'>): MCPServer {
    return mcpManager.registerServer(server);
  }

  /**
   * Connect to MCP server
   */
  async connectToMCPServer(serverName: string): Promise<any> {
    return mcpManager.connectToServer(serverName);
  }

  /**
   * Call MCP tool
   */
  async callMCPTool(connectionId: string, toolName: string, args: Record<string, any>): Promise<any> {
    return mcpManager.callTool(connectionId, toolName, args);
  }

  // ==================== Layer 6: Verification ====================

  /**
   * Verify output against identity rules
   */
  verifyOutput(output: string, context?: Record<string, any>): VerificationResult {
    // Check for common issues
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for external email without approval
    if (output.toLowerCase().includes('send') && output.toLowerCase().includes('email')) {
      const validation = identityManager.validateAction(output, context);
      if (!validation.valid) {
        return {
          valid: false,
          violations: validation.violations,
          warnings: validation.warnings,
          suggestions: ['Get approval before sending external emails']
        };
      }
    }

    // Check for direct push to main
    if (output.toLowerCase().includes('push') && output.toLowerCase().includes('main')) {
      return {
        valid: false,
        violations: [{
          id: 'verify-1',
          category: 'security',
          rule: 'Never push directly to main',
          description: 'All changes must go through PR review',
          enforced: true,
          severity: 'critical'
        }],
        warnings: [],
        suggestions: ['Create a feature branch and submit a PR']
      };
    }

    return {
      valid: true,
      violations: [],
      warnings: [],
      suggestions: []
    };
  }

  /**
   * Audit Agent OS health
   */
  auditHealth(): {
    identityHealth: 'healthy' | 'warning' | 'critical';
    contextHealth: 'healthy' | 'warning' | 'critical';
    skillsHealth: 'healthy' | 'warning' | 'critical';
    memoryHealth: 'healthy' | 'warning' | 'critical';
    overallHealth: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check identity
    const identity = identityManager.getIdentity();
    const identityHealth = identity ? 
      (identity.rules.length > 0 ? 'healthy' : 'warning') : 
      'warning';

    if (!identity) {
      issues.push('No identity configured');
      recommendations.push('Set up user identity for personalized experience');
    }

    // Check context
    const contextStats = contextPortfolioManager.getStats();
    const contextHealth = contextStats.totalEntries > 0 ? 'healthy' : 'warning';

    if (contextStats.totalEntries === 0) {
      issues.push('No context entries');
      recommendations.push('Add team, product, and goal context');
    }

    // Check skills
    const skillsStats = skillsLibrary.getStats();
    const skillsHealth = skillsStats.totalSkills > 0 ? 'healthy' : 'warning';

    if (skillsStats.totalSkills === 0) {
      issues.push('No skills defined');
      recommendations.push('Create reusable skills for common workflows');
    }

    // Check memory
    const memoryStats = memoryManager.getStats();
    const memoryHealth = memoryStats.totalEntries > 0 ? 'healthy' : 'warning';

    // Check connections
    const connectionStats = mcpManager.getStats();
    const connectionsHealth = connectionStats.connectedServers > 0 ? 'healthy' : 'warning';

    // Overall health
    const healthScores = [identityHealth, contextHealth, skillsHealth, memoryHealth, connectionsHealth];
    const overallHealth = healthScores.includes('critical') ? 'critical' :
      healthScores.filter(h => h === 'warning').length > 2 ? 'warning' : 'healthy';

    return {
      identityHealth,
      contextHealth,
      skillsHealth,
      memoryHealth,
      overallHealth,
      issues,
      recommendations
    };
  }

  // ==================== Layer 7: Automation ====================

  /**
   * Create automation rule
   */
  createAutomationRule(rule: {
    name: string;
    trigger: string;
    action: string;
    enabled: boolean;
  }): { id: string; name: string; trigger: string; action: string; enabled: boolean; createdAt: string } {
    return {
      id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...rule,
      createdAt: new Date().toISOString()
    };
  }

  // ==================== State & Stats ====================

  /**
   * Get Agent OS state
   */
  getState(): AgentOSState {
    const identity = identityManager.getIdentity();
    const contextStats = contextPortfolioManager.getStats();
    const skillsStats = skillsLibrary.getStats();
    const memoryStats = memoryManager.getStats();
    const connectionStats = mcpManager.getStats();

    return {
      identity,
      contextStats: {
        totalEntries: contextStats.totalEntries,
        byCategory: contextStats.byCategory
      },
      skillsStats: {
        totalSkills: skillsStats.totalSkills,
        totalExecutions: skillsStats.totalExecutions
      },
      memoryStats: {
        totalEntries: memoryStats.totalEntries,
        totalAccessCount: memoryStats.totalAccessCount
      },
      connectionStats: {
        totalServers: connectionStats.totalServers,
        connectedServers: connectionStats.connectedServers
      }
    };
  }

  /**
   * Export Agent OS configuration
   */
  exportConfig(): object {
    return {
      identity: identityManager.getIdentity(),
      context: contextPortfolioManager.exportEntries(),
      skills: skillsLibrary.exportSkills(),
      memory: memoryManager.exportMemories()
    };
  }

  /**
   * Import Agent OS configuration
   */
  importConfig(config: {
    identity?: Partial<UserIdentity>;
    context?: ContextEntry[];
    skills?: Skill[];
    memory?: MemoryEntry[];
  }): void {
    if (config.identity) {
      identityManager.setIdentity(config.identity);
    }

    if (config.context) {
      contextPortfolioManager.importEntries(config.context);
    }

    if (config.skills) {
      skillsLibrary.importSkills(config.skills);
    }

    if (config.memory) {
      memoryManager.importMemories(config.memory);
    }
  }

  /**
   * Clear all Agent OS data
   */
  clear(): void {
    identityManager.setIdentity({});
    contextPortfolioManager.clear();
    skillsLibrary.clear();
    memoryManager.clear();
  }
}

// Singleton instance
export const agentOS = new AgentOS();
