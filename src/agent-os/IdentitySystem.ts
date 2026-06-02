/**
 * Agent OS Layer 1: Identity System
 * 
 * Defines who the user is and what rules should be enforced.
 * Based on Personal Agent OS Layer 1 from Obsidian vault.
 */

export interface UserIdentity {
  id: string;
  name: string;
  email?: string;
  role?: string;
  company?: string;
  
  // Communication Preferences
  communicationStyle: 'direct' | 'diplomatic' | 'casual' | 'formal';
  responseFormat: 'bullets' | 'prose' | 'mixed';
  verbosity: 'concise' | 'moderate' | 'detailed';
  
  // Values & Priorities
  values: string[];
  priorities: string[];
  
  // Non-negotiable Rules
  rules: IdentityRule[];
  
  // Preferences
  preferences: Record<string, any>;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface IdentityRule {
  id: string;
  category: 'communication' | 'approval' | 'security' | 'quality' | 'custom';
  rule: string;
  description: string;
  enforced: boolean;
  severity: 'info' | 'low' | 'medium' | 'high' | 'warning' | 'critical';
}

export interface IdentityTemplate {
  name: string;
  description: string;
  identity: Partial<UserIdentity>;
}

/**
 * Identity Manager - Handles user identity and rules
 */
export class IdentityManager {
  private identity: UserIdentity | null = null;
  private templates: IdentityTemplate[] = [];

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default identity templates
   */
  private initializeDefaultTemplates(): void {
    this.templates = [
      {
        name: 'developer',
        description: 'Software developer identity',
        identity: {
          communicationStyle: 'direct',
          responseFormat: 'mixed',
          verbosity: 'moderate',
          values: ['code quality', 'efficiency', 'maintainability'],
          priorities: ['testing', 'documentation', 'performance'],
          rules: [
            {
              id: 'dev-1',
              category: 'quality',
              rule: 'Always write tests before code',
              description: 'TDD approach for all implementations',
              enforced: true,
              severity: 'critical'
            },
            {
              id: 'dev-2',
              category: 'approval',
              rule: 'Never push directly to main',
              description: 'All changes must go through PR review',
              enforced: true,
              severity: 'critical'
            }
          ]
        }
      },
      {
        name: 'manager',
        description: 'Project manager identity',
        identity: {
          communicationStyle: 'diplomatic',
          responseFormat: 'bullets',
          verbosity: 'concise',
          values: ['clarity', 'accountability', 'timeliness'],
          priorities: ['deadlines', 'stakeholder alignment', 'risk management'],
          rules: [
            {
              id: 'mgr-1',
              category: 'approval',
              rule: 'Never send external email without draft approval',
              description: 'All external communications must be reviewed first',
              enforced: true,
              severity: 'critical'
            },
            {
              id: 'mgr-2',
              category: 'communication',
              rule: 'Always include action items in meeting notes',
              description: 'Every meeting summary must have clear next steps',
              enforced: true,
              severity: 'high'
            }
          ]
        }
      },
      {
        name: 'creative',
        description: 'Creative professional identity',
        identity: {
          communicationStyle: 'casual',
          responseFormat: 'prose',
          verbosity: 'detailed',
          values: ['creativity', 'originality', 'user experience'],
          priorities: ['design quality', 'user feedback', 'innovation'],
          rules: [
            {
              id: 'creative-1',
              category: 'quality',
              rule: 'Always present 3 options before deciding',
              description: 'Explore multiple creative directions',
              enforced: true,
              severity: 'medium'
            }
          ]
        }
      }
    ];
  }

  /**
   * Create or update user identity
   */
  setIdentity(identity: Partial<UserIdentity>): UserIdentity {
    if (this.identity) {
      // Update existing identity
      this.identity = {
        ...this.identity,
        ...identity,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Create new identity
      this.identity = {
        id: `user-${Date.now()}`,
        name: identity.name || 'User',
        communicationStyle: identity.communicationStyle || 'direct',
        responseFormat: identity.responseFormat || 'mixed',
        verbosity: identity.verbosity || 'moderate',
        values: identity.values || [],
        priorities: identity.priorities || [],
        rules: identity.rules || [],
        preferences: identity.preferences || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    return this.identity;
  }

  /**
   * Get current identity
   */
  getIdentity(): UserIdentity | null {
    return this.identity;
  }

  /**
   * Load identity from template
   */
  loadTemplate(templateName: string): UserIdentity | null {
    const template = this.templates.find(t => t.name === templateName);
    if (!template) return null;

    return this.setIdentity(template.identity);
  }

  /**
   * Add a rule to identity
   */
  addRule(rule: Omit<IdentityRule, 'id'>): IdentityRule | null {
    if (!this.identity) return null;

    const newRule: IdentityRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    this.identity.rules.push(newRule);
    this.identity.updatedAt = new Date().toISOString();

    return newRule;
  }

  /**
   * Remove a rule from identity
   */
  removeRule(ruleId: string): boolean {
    if (!this.identity) return false;

    const index = this.identity.rules.findIndex(r => r.id === ruleId);
    if (index === -1) return false;

    this.identity.rules.splice(index, 1);
    this.identity.updatedAt = new Date().toISOString();

    return true;
  }

  /**
   * Update a rule
   */
  updateRule(ruleId: string, updates: Partial<IdentityRule>): boolean {
    if (!this.identity) return false;

    const rule = this.identity.rules.find(r => r.id === ruleId);
    if (!rule) return false;

    Object.assign(rule, updates);
    this.identity.updatedAt = new Date().toISOString();

    return true;
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: IdentityRule['category']): IdentityRule[] {
    if (!this.identity) return [];

    return this.identity.rules.filter(r => r.category === category);
  }

  /**
   * Get enforced rules
   */
  getEnforcedRules(): IdentityRule[] {
    if (!this.identity) return [];

    return this.identity.rules.filter(r => r.enforced);
  }

  /**
   * Validate action against rules
   */
  validateAction(action: string, context?: Record<string, any>): {
    valid: boolean;
    violations: IdentityRule[];
    warnings: IdentityRule[];
  } {
    if (!this.identity) {
      return { valid: true, violations: [], warnings: [] };
    }

    const violations: IdentityRule[] = [];
    const warnings: IdentityRule[] = [];

    // Check each enforced rule
    this.identity.rules
      .filter(r => r.enforced)
      .forEach(rule => {
        // Simple keyword matching (in production, this would be more sophisticated)
        const actionLower = action.toLowerCase();
        const ruleLower = rule.rule.toLowerCase();

        // Check for violations based on rule category
        switch (rule.category) {
          case 'approval':
            if (actionLower.includes('send') && actionLower.includes('email') && 
                !actionLower.includes('draft') && !actionLower.includes('approve')) {
              if (rule.severity === 'critical') {
                violations.push(rule);
              } else {
                warnings.push(rule);
              }
            }
            break;
          case 'security':
            if (actionLower.includes('push') && actionLower.includes('main')) {
              violations.push(rule);
            }
            break;
          case 'quality':
            if (actionLower.includes('implement') && !actionLower.includes('test')) {
              if (rule.severity === 'critical') {
                violations.push(rule);
              } else {
                warnings.push(rule);
              }
            }
            break;
        }
      });

    return {
      valid: violations.length === 0,
      violations,
      warnings
    };
  }

  /**
   * Get all templates
   */
  getTemplates(): IdentityTemplate[] {
    return this.templates;
  }

  /**
   * Add custom template
   */
  addTemplate(template: IdentityTemplate): void {
    this.templates.push(template);
  }

  /**
   * Export identity as markdown
   */
  exportAsMarkdown(): string {
    if (!this.identity) return '# No Identity Set\n';

    const lines = [
      `# User Identity`,
      '',
      `## Basic Info`,
      `- **Name**: ${this.identity.name}`,
      this.identity.email ? `- **Email**: ${this.identity.email}` : '',
      this.identity.role ? `- **Role**: ${this.identity.role}` : '',
      this.identity.company ? `- **Company**: ${this.identity.company}` : '',
      '',
      `## Communication Style`,
      `- **Style**: ${this.identity.communicationStyle}`,
      `- **Response Format**: ${this.identity.responseFormat}`,
      `- **Verbosity**: ${this.identity.verbosity}`,
      '',
      `## Values`,
      ...this.identity.values.map(v => `- ${v}`),
      '',
      `## Priorities`,
      ...this.identity.priorities.map(p => `- ${p}`),
      '',
      `## Rules`,
      ...this.identity.rules.map(r => 
        `- [${r.enforced ? 'x' : ' '}] **${r.category.toUpperCase()}**: ${r.rule}`
      ),
      '',
      `## Preferences`,
      ...Object.entries(this.identity.preferences).map(([k, v]) => `- **${k}**: ${v}`)
    ];

    return lines.filter(l => l !== undefined).join('\n');
  }

  /**
   * Import identity from markdown
   */
  importFromMarkdown(markdown: string): UserIdentity | null {
    // Simple parser (in production, use a proper markdown parser)
    const lines = markdown.split('\n');
    const identity: Partial<UserIdentity> = {
      rules: []
    };

    let currentSection = '';

    lines.forEach(line => {
      if (line.startsWith('# ')) {
        // Title
      } else if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '').toLowerCase();
      } else if (line.startsWith('- **') && line.includes('**:')) {
        const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
        if (match) {
          const [, key, value] = match;
          switch (key.toLowerCase()) {
            case 'name':
              identity.name = value;
              break;
            case 'email':
              identity.email = value;
              break;
            case 'role':
              identity.role = value;
              break;
            case 'company':
              identity.company = value;
              break;
            case 'style':
              identity.communicationStyle = value as any;
              break;
            case 'response format':
              identity.responseFormat = value as any;
              break;
            case 'verbosity':
              identity.verbosity = value as any;
              break;
          }
        }
      } else if (line.startsWith('- [') && currentSection === 'rules') {
        const match = line.match(/- \[([ x])\] \*\*(.+?)\*\*: (.+)/);
        if (match) {
          const [, enforced, category, rule] = match;
          identity.rules?.push({
            id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category: category.toLowerCase() as any,
            rule,
            description: '',
            enforced: enforced === 'x',
            severity: 'medium'
          });
        }
      }
    });

    return this.setIdentity(identity);
  }
}

// Singleton instance
export const identityManager = new IdentityManager();
