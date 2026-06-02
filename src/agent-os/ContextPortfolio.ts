/**
 * Agent OS Layer 2: Context Portfolio
 * 
 * Manages what the user knows - team, product, customers, goals, stakeholders.
 * Based on Personal Agent OS Layer 2 from Obsidian vault.
 */

export type ContextCategory = 
  | 'team' 
  | 'product' 
  | 'customers' 
  | 'goals' 
  | 'stakeholders' 
  | 'organization'
  | 'project'
  | 'custom';

export interface ContextEntry {
  id: string;
  category: ContextCategory;
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastAccessed: string;
  accessCount: number;
  importance: 'low' | 'medium' | 'high' | 'critical';
}

export interface ContextTemplate {
  category: ContextCategory;
  title: string;
  description: string;
  fields: Array<{
    name: string;
    type: 'text' | 'textarea' | 'list' | 'key-value';
    required: boolean;
    placeholder?: string;
  }>;
}

/**
 * Context Manager - Handles context portfolio
 */
export class ContextPortfolioManager {
  private entries: Map<string, ContextEntry> = new Map();
  private categoryIndex: Map<ContextCategory, Set<string>> = new Map();
  private templates: ContextTemplate[] = [];

  constructor() {
    this.initializeTemplates();
    this.initializeCategoryIndex();
  }

  /**
   * Initialize context templates
   */
  private initializeTemplates(): void {
    this.templates = [
      {
        category: 'team',
        title: 'Team Information',
        description: 'Team structure and relationships',
        fields: [
          { name: 'teamName', type: 'text', required: true, placeholder: 'Engineering Team' },
          { name: 'members', type: 'list', required: true, placeholder: 'John (Backend), Sarah (Frontend)' },
          { name: 'reportingStructure', type: 'text', required: false, placeholder: 'Reports to VP Engineering' },
          { name: 'currentFocus', type: 'textarea', required: false, placeholder: 'Q2 sprint on authentication' }
        ]
      },
      {
        category: 'product',
        title: 'Product Information',
        description: 'Product roadmap and priorities',
        fields: [
          { name: 'productName', type: 'text', required: true, placeholder: 'NexusFlow' },
          { name: 'description', type: 'textarea', required: true, placeholder: 'AI-powered development platform' },
          { name: 'roadmap', type: 'textarea', required: false, placeholder: 'Q1: Auth, Q2: Payments, Q3: Analytics' },
          { name: 'keyMetrics', type: 'key-value', required: false, placeholder: 'DAU: 1000, MRR: $50k' }
        ]
      },
      {
        category: 'customers',
        title: 'Customer Information',
        description: 'Customer segments and needs',
        fields: [
          { name: 'segments', type: 'list', required: true, placeholder: 'Enterprise, SMB, Individual' },
          { name: 'painPoints', type: 'list', required: false, placeholder: 'Slow onboarding, complex pricing' },
          { name: 'feedback', type: 'textarea', required: false, placeholder: 'Recent customer feedback themes' }
        ]
      },
      {
        category: 'goals',
        title: 'Quarterly Goals',
        description: 'Current objectives and key results',
        fields: [
          { name: 'quarter', type: 'text', required: true, placeholder: 'Q2 2026' },
          { name: 'objectives', type: 'list', required: true, placeholder: 'Launch v2.0, Reduce churn by 20%' },
          { name: 'keyResults', type: 'list', required: false, placeholder: 'KR1: 1000 new users, KR2: NPS > 50' },
          { name: 'deadline', type: 'text', required: false, placeholder: '2026-06-30' }
        ]
      },
      {
        category: 'stakeholders',
        title: 'Key Stakeholders',
        description: 'Important stakeholders and relationships',
        fields: [
          { name: 'name', type: 'text', required: true, placeholder: 'Jane Smith' },
          { name: 'role', type: 'text', required: true, placeholder: 'CTO' },
          { name: 'priorities', type: 'list', required: false, placeholder: 'Cost reduction, scalability' },
          { name: 'communicationStyle', type: 'text', required: false, placeholder: 'Prefers email, formal tone' }
        ]
      },
      {
        category: 'project',
        title: 'Project Context',
        description: 'Current project details',
        fields: [
          { name: 'projectName', type: 'text', required: true, placeholder: 'Auth System Redesign' },
          { name: 'status', type: 'text', required: true, placeholder: 'In Progress' },
          { name: 'techStack', type: 'list', required: false, placeholder: 'React, Node.js, PostgreSQL' },
          { name: 'deadlines', type: 'key-value', required: false, placeholder: 'MVP: 2026-04-01, Launch: 2026-05-01' }
        ]
      }
    ];
  }

  /**
   * Initialize category index
   */
  private initializeCategoryIndex(): void {
    const categories: ContextCategory[] = [
      'team', 'product', 'customers', 'goals', 
      'stakeholders', 'organization', 'project', 'custom'
    ];
    categories.forEach(cat => this.categoryIndex.set(cat, new Set()));
  }

  /**
   * Add a context entry
   */
  addEntry(entry: Omit<ContextEntry, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessed' | 'accessCount'>): ContextEntry {
    const newEntry: ContextEntry = {
      ...entry,
      id: `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 0
    };

    this.entries.set(newEntry.id, newEntry);

    // Update category index
    const categorySet = this.categoryIndex.get(entry.category) || new Set();
    categorySet.add(newEntry.id);
    this.categoryIndex.set(entry.category, categorySet);

    return newEntry;
  }

  /**
   * Get a context entry
   */
  getEntry(id: string): ContextEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      entry.lastAccessed = new Date().toISOString();
      entry.accessCount++;
    }
    return entry;
  }

  /**
   * Update a context entry
   */
  updateEntry(id: string, updates: Partial<Omit<ContextEntry, 'id' | 'createdAt'>>): ContextEntry | null {
    const entry = this.entries.get(id);
    if (!entry) return null;

    // Remove from old category index if category changed
    if (updates.category && updates.category !== entry.category) {
      const oldCategorySet = this.categoryIndex.get(entry.category);
      if (oldCategorySet) {
        oldCategorySet.delete(id);
      }
    }

    Object.assign(entry, updates, { updatedAt: new Date().toISOString() });

    // Update category index if category changed
    if (updates.category) {
      const newCategorySet = this.categoryIndex.get(updates.category) || new Set();
      newCategorySet.add(id);
      this.categoryIndex.set(updates.category, newCategorySet);
    }

    return entry;
  }

  /**
   * Delete a context entry
   */
  deleteEntry(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    // Remove from category index
    const categorySet = this.categoryIndex.get(entry.category);
    if (categorySet) {
      categorySet.delete(id);
    }

    this.entries.delete(id);
    return true;
  }

  /**
   * Get entries by category
   */
  getEntriesByCategory(category: ContextCategory): ContextEntry[] {
    const ids = this.categoryIndex.get(category) || new Set();
    return Array.from(ids)
      .map(id => this.entries.get(id))
      .filter((e): e is ContextEntry => e !== undefined);
  }

  /**
   * Search entries
   */
  searchEntries(query: string): ContextEntry[] {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.entries.values()).filter(entry =>
      entry.title.toLowerCase().includes(lowerQuery) ||
      entry.content.toLowerCase().includes(lowerQuery) ||
      entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get recent entries
   */
  getRecentEntries(limit: number = 10): ContextEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Get important entries
   */
  getImportantEntries(limit: number = 10): ContextEntry[] {
    const importanceOrder = ['critical', 'high', 'medium', 'low'];

    return Array.from(this.entries.values())
      .sort((a, b) => {
        const aIdx = importanceOrder.indexOf(a.importance);
        const bIdx = importanceOrder.indexOf(b.importance);
        return aIdx - bIdx;
      })
      .slice(0, limit);
  }

  /**
   * Get templates
   */
  getTemplates(): ContextTemplate[] {
    return this.templates;
  }

  /**
   * Get template by category
   */
  getTemplateByCategory(category: ContextCategory): ContextTemplate | undefined {
    return this.templates.find(t => t.category === category);
  }

  /**
   * Create entry from template
   */
  createFromTemplate(category: ContextCategory, data: Record<string, any>): ContextEntry | null {
    const template = this.templates.find(t => t.category === category);
    if (!template) return null;

    // Validate required fields
    for (const field of template.fields) {
      if (field.required && !data[field.name]) {
        console.error(`[Context] Missing required field: ${field.name}`);
        return null;
      }
    }

    // Convert data to content string
    const content = Object.entries(data)
      .map(([key, value]) => `**${key}**: ${value}`)
      .join('\n');

    return this.addEntry({
      category,
      title: template.title,
      content,
      tags: [category],
      metadata: data,
      importance: 'medium'
    });
  }

  /**
   * Export all entries as JSON
   */
  exportEntries(): ContextEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Import entries from JSON
   */
  importEntries(entries: ContextEntry[]): number {
    let imported = 0;

    entries.forEach(entry => {
      if (!this.entries.has(entry.id)) {
        this.entries.set(entry.id, entry);

        // Update category index
        const categorySet = this.categoryIndex.get(entry.category) || new Set();
        categorySet.add(entry.id);
        this.categoryIndex.set(entry.category, categorySet);

        imported++;
      }
    });

    return imported;
  }

  /**
   * Export as markdown
   */
  exportAsMarkdown(): string {
    const lines: string[] = ['# Context Portfolio', ''];

    const categories: ContextCategory[] = [
      'team', 'product', 'customers', 'goals', 
      'stakeholders', 'organization', 'project'
    ];

    categories.forEach(category => {
      const entries = this.getEntriesByCategory(category);
      if (entries.length > 0) {
        lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}`);
        entries.forEach(entry => {
          lines.push(`### ${entry.title}`);
          lines.push(entry.content);
          lines.push('');
        });
      }
    });

    return lines.join('\n');
  }

  /**
   * Get stats
   */
  getStats(): {
    totalEntries: number;
    byCategory: Record<ContextCategory, number>;
    recentlyUpdated: number;
  } {
    const entries = Array.from(this.entries.values());
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const byCategory: Record<ContextCategory, number> = {
      team: 0,
      product: 0,
      customers: 0,
      goals: 0,
      stakeholders: 0,
      organization: 0,
      project: 0,
      custom: 0
    };

    entries.forEach(e => byCategory[e.category]++);

    return {
      totalEntries: entries.length,
      byCategory,
      recentlyUpdated: entries.filter(e => 
        new Date(e.updatedAt).getTime() > oneDayAgo
      ).length
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.categoryIndex.clear();
    this.initializeCategoryIndex();
  }
}

// Singleton instance
export const contextPortfolioManager = new ContextPortfolioManager();
