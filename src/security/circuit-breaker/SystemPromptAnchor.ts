/**
 * Security: System Prompt Anchoring
 * 
 * Prevents context drifting by keeping structural rules in context.
 * Based on PRIDES Framework Paper Part 3 from Obsidian vault.
 */

export interface AnchorRule {
  id: string;
  name: string;
  content: string;
  priority: number;
  enabled: boolean;
  category: 'architecture' | 'security' | 'quality' | 'modularity' | 'custom';
  createdAt: string;
  updatedAt: string;
}

export interface ContextBlock {
  id: string;
  type: 'anchor' | 'rag' | 'user';
  content: string;
  tokenCount: number;
  priority: number;
  metadata: Record<string, any>;
}

export interface AnchoredPrompt {
  id: string;
  systemAnchor: ContextBlock[];
  ragRetrieval: ContextBlock[];
  userPrompt: ContextBlock[];
  totalTokens: number;
  createdAt: string;
}

export interface SystemPromptAnchorConfig {
  enabled: boolean;
  maxAnchorTokens: number;
  maxRagTokens: number;
  maxTotalTokens: number;
  autoPrune: boolean;
  saliencyDecayRate: number;
  enforceModularity: boolean;
  maxFileSize: number;
}

const DEFAULT_CONFIG: SystemPromptAnchorConfig = {
  enabled: true,
  maxAnchorTokens: 2000,
  maxRagTokens: 5000,
  maxTotalTokens: 10000,
  autoPrune: true,
  saliencyDecayRate: 0.1,
  enforceModularity: true,
  maxFileSize: 500
};

/**
 * System Prompt Anchor - Prevents context drifting
 */
export class SystemPromptAnchor {
  private rules: Map<string, AnchorRule> = new Map();
  private config: SystemPromptAnchorConfig;

  constructor(config: Partial<SystemPromptAnchorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultRules();
  }

  /**
   * Initialize default anchor rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: Omit<AnchorRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Modularity Limit',
        content: 'CRITICAL RULE: No file shall exceed 500 lines. If approaching limit, split into smaller modules.',
        priority: 100,
        enabled: true,
        category: 'modularity'
      },
      {
        name: 'Architecture Pattern',
        content: 'ARCHITECTURE: Follow single responsibility principle. Each module should have one clear purpose.',
        priority: 90,
        enabled: true,
        category: 'architecture'
      },
      {
        name: 'Security First',
        content: 'SECURITY: Never hardcode credentials. Use environment variables or secret manager. Validate all inputs.',
        priority: 95,
        enabled: true,
        category: 'security'
      },
      {
        name: 'Testing Requirement',
        content: 'QUALITY: All new code must have corresponding tests. Maintain >80% test coverage.',
        priority: 85,
        enabled: true,
        category: 'quality'
      },
      {
        name: 'Error Handling',
        content: 'QUALITY: Always handle errors gracefully. Never swallow errors silently. Log errors for debugging.',
        priority: 80,
        enabled: true,
        category: 'quality'
      },
      {
        name: 'Documentation',
        content: 'QUALITY: Document public APIs with JSDoc. Add comments for complex logic.',
        priority: 70,
        enabled: true,
        category: 'quality'
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }

  /**
   * Add an anchor rule
   */
  addRule(ruleData: Omit<AnchorRule, 'id' | 'createdAt' | 'updatedAt'>): AnchorRule {
    const rule: AnchorRule = {
      ...ruleData,
      id: `anchor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.rules.set(rule.id, rule);
    return rule;
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): AnchorRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: AnchorRule['category']): AnchorRule[] {
    return Array.from(this.rules.values())
      .filter(r => r.category === category)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get enabled rules sorted by priority
   */
  getEnabledRules(): AnchorRule[] {
    return Array.from(this.rules.values())
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Build anchored prompt
   */
  buildAnchoredPrompt(
    userPrompt: string,
    ragContext?: string[],
    customAnchors?: string[]
  ): AnchoredPrompt {
    const systemAnchor = this.buildSystemAnchor(customAnchors);
    const ragRetrieval = this.buildRagRetrieval(ragContext || []);
    const userPromptBlock = this.buildUserPrompt(userPrompt);

    const totalTokens = systemAnchor.reduce((sum, b) => sum + b.tokenCount, 0) +
                        ragRetrieval.reduce((sum, b) => sum + b.tokenCount, 0) +
                        userPromptBlock.reduce((sum, b) => sum + b.tokenCount, 0);

    return {
      id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      systemAnchor,
      ragRetrieval,
      userPrompt: userPromptBlock,
      totalTokens,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Build system anchor blocks
   */
  private buildSystemAnchor(customAnchors?: string[]): ContextBlock[] {
    const blocks: ContextBlock[] = [];
    let tokenCount = 0;

    // Add enabled rules
    const rules = this.getEnabledRules();
    for (const rule of rules) {
      const ruleTokens = this.estimateTokens(rule.content);
      if (tokenCount + ruleTokens <= this.config.maxAnchorTokens) {
        blocks.push({
          id: rule.id,
          type: 'anchor',
          content: `[${rule.category.toUpperCase()}] ${rule.content}`,
          tokenCount: ruleTokens,
          priority: rule.priority,
          metadata: { ruleId: rule.id, category: rule.category }
        });
        tokenCount += ruleTokens;
      }
    }

    // Add custom anchors
    if (customAnchors) {
      for (const anchor of customAnchors) {
        const anchorTokens = this.estimateTokens(anchor);
        if (tokenCount + anchorTokens <= this.config.maxAnchorTokens) {
          blocks.push({
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'anchor',
            content: anchor,
            tokenCount: anchorTokens,
            priority: 50,
            metadata: { custom: true }
          });
          tokenCount += anchorTokens;
        }
      }
    }

    return blocks;
  }

  /**
   * Build RAG retrieval blocks
   */
  private buildRagRetrieval(contexts: string[]): ContextBlock[] {
    const blocks: ContextBlock[] = [];
    let tokenCount = 0;

    for (const context of contexts) {
      const contextTokens = this.estimateTokens(context);
      if (tokenCount + contextTokens <= this.config.maxRagTokens) {
        blocks.push({
          id: `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'rag',
          content: context,
          tokenCount: contextTokens,
          priority: 30,
          metadata: { source: 'rag' }
        });
        tokenCount += contextTokens;
      }
    }

    return blocks;
  }

  /**
   * Build user prompt blocks
   */
  private buildUserPrompt(prompt: string): ContextBlock[] {
    const tokenCount = this.estimateTokens(prompt);

    return [{
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content: prompt,
      tokenCount,
      priority: 10,
      metadata: { source: 'user' }
    }];
  }

  /**
   * Estimate token count (approximate)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if file exceeds modularity limit
   */
  checkModularity(fileContent: string): {
    compliant: boolean;
    lineCount: number;
    limit: number;
    excess: number;
  } {
    const lineCount = fileContent.split('\n').length;
    const compliant = lineCount <= this.config.maxFileSize;
    const excess = compliant ? 0 : lineCount - this.config.maxFileSize;

    return {
      compliant,
      lineCount,
      limit: this.config.maxFileSize,
      excess
    };
  }

  /**
   * Check saliency decay
   */
  checkSaliencyDecay(contextLength: number, ruleCount: number): {
    healthy: boolean;
    saliencyScore: number;
    recommendation: string;
  } {
    // As context grows, saliency of rules decreases
    const saliencyScore = 1 / (1 + (contextLength / 1000) * this.config.saliencyDecayRate);
    const healthy = saliencyScore > 0.5;

    let recommendation = '';
    if (!healthy) {
      recommendation = 'Context too long. Consider pruning or using RAG to retrieve relevant rules.';
    } else if (saliencyScore < 0.7) {
      recommendation = 'Saliency decreasing. Consider reinforcing critical rules.';
    }

    return {
      healthy,
      saliencyScore,
      recommendation
    };
  }

  /**
   * Get System Prompt Anchor stats
   */
  getStats(): {
    totalRules: number;
    enabledRules: number;
    rulesByCategory: Record<AnchorRule['category'], number>;
    averagePriority: number;
  } {
    const rules = Array.from(this.rules.values());
    const enabled = rules.filter(r => r.enabled);

    const rulesByCategory: Record<AnchorRule['category'], number> = {
      architecture: 0,
      security: 0,
      quality: 0,
      modularity: 0,
      custom: 0
    };

    rules.forEach(r => rulesByCategory[r.category]++);

    const totalPriority = rules.reduce((sum, r) => sum + r.priority, 0);

    return {
      totalRules: rules.length,
      enabledRules: enabled.length,
      rulesByCategory,
      averagePriority: rules.length > 0 ? totalPriority / rules.length : 0
    };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<SystemPromptAnchorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get config
   */
  getConfig(): SystemPromptAnchorConfig {
    return { ...this.config };
  }

  /**
   * Clear all rules
   */
  clear(): void {
    this.rules.clear();
  }
}

// Singleton instance
export const systemPromptAnchor = new SystemPromptAnchor();
