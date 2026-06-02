/**
 * Persistent Memory System
 * 
 * Implements cross-session memory persistence for agents
 * Based on Agent OS Layer 4 (Memory) from Obsidian vault.
 */

export type MemoryType = 
  | 'decision'      // Major decisions and rationale
  | 'learning'      // What was learned
  | 'relationship'  // Context about people/interactions
  | 'preference'    // User preferences
  | 'error'         // Errors and how they were fixed
  | 'success'       // Successful patterns
  | 'context'       // Project/team/product context
  | 'custom';       // Custom memory type

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  accessCount: number;
  importance: 'low' | 'medium' | 'high' | 'critical';
  relatedEntries: string[];
  source?: {
    agentId: string;
    sessionId: string;
    timestamp: string;
  };
}

export interface MemoryQuery {
  type?: MemoryType;
  tags?: string[];
  importance?: MemoryEntry['importance'];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'accessedAt' | 'importance';
  sortOrder?: 'asc' | 'desc';
}

export interface MemoryStats {
  totalEntries: number;
  byType: Record<MemoryType, number>;
  byImportance: Record<MemoryEntry['importance'], number>;
  totalAccessCount: number;
  averageAccessCount: number;
  oldestEntry?: string;
  newestEntry?: string;
}

export interface MemoryConfig {
  maxEntries: number;
  maxEntrySize: number;
  autoCleanup: boolean;
  cleanupMaxAgeMs: number;
  importanceThreshold: MemoryEntry['importance'];
}

const DEFAULT_CONFIG: MemoryConfig = {
  maxEntries: 10000,
  maxEntrySize: 10000,
  autoCleanup: true,
  cleanupMaxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  importanceThreshold: 'low'
};

/**
 * Memory Manager - Handles persistent memory storage
 */
export class MemoryManager {
  private memories: Map<string, MemoryEntry> = new Map();
  private config: MemoryConfig;
  private tagsIndex: Map<string, Set<string>> = new Map(); // tag -> memory IDs
  private typeIndex: Map<MemoryType, Set<string>> = new Map(); // type -> memory IDs

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeIndexes();
  }

  /**
   * Initialize indexes
   */
  private initializeIndexes(): void {
    // Initialize type index
    const types: MemoryType[] = [
      'decision', 'learning', 'relationship', 'preference',
      'error', 'success', 'context', 'custom'
    ];
    types.forEach(type => this.typeIndex.set(type, new Set()));
  }

  /**
   * Add a memory entry
   */
  addMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessedAt' | 'accessCount'>): MemoryEntry {
    // Check entry size
    if (entry.content.length > this.config.maxEntrySize) {
      console.warn(`[Memory] Entry content exceeds max size (${this.config.maxEntrySize})`);
    }

    // Check max entries
    if (this.memories.size >= this.config.maxEntries) {
      this.cleanup();
    }

    const memory: MemoryEntry = {
      ...entry,
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0
    };

    this.memories.set(memory.id, memory);

    // Update indexes
    this.updateIndexes(memory);

    return memory;
  }

  /**
   * Update indexes for a memory entry
   */
  private updateIndexes(memory: MemoryEntry): void {
    // Update type index
    const typeSet = this.typeIndex.get(memory.type) || new Set();
    typeSet.add(memory.id);
    this.typeIndex.set(memory.type, typeSet);

    // Update tags index
    memory.tags.forEach(tag => {
      const tagSet = this.tagsIndex.get(tag) || new Set();
      tagSet.add(memory.id);
      this.tagsIndex.set(tag, tagSet);
    });
  }

  /**
   * Remove indexes for a memory entry
   */
  private removeIndexes(memory: MemoryEntry): void {
    // Remove from type index
    const typeSet = this.typeIndex.get(memory.type);
    if (typeSet) {
      typeSet.delete(memory.id);
    }

    // Remove from tags index
    memory.tags.forEach(tag => {
      const tagSet = this.tagsIndex.get(tag);
      if (tagSet) {
        tagSet.delete(memory.id);
      }
    });
  }

  /**
   * Get a memory entry by ID
   */
  getMemory(id: string): MemoryEntry | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      memory.accessedAt = new Date().toISOString();
      memory.accessCount++;
    }
    return memory;
  }

  /**
   * Update a memory entry
   */
  updateMemory(id: string, updates: Partial<Omit<MemoryEntry, 'id' | 'createdAt'>>): MemoryEntry | null {
    const memory = this.memories.get(id);
    if (!memory) return null;

    // Remove old indexes
    this.removeIndexes(memory);

    // Apply updates
    const updatedMemory: MemoryEntry = {
      ...memory,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.memories.set(id, updatedMemory);

    // Update indexes
    this.updateIndexes(updatedMemory);

    return updatedMemory;
  }

  /**
   * Delete a memory entry
   */
  deleteMemory(id: string): boolean {
    const memory = this.memories.get(id);
    if (!memory) return false;

    // Remove indexes
    this.removeIndexes(memory);

    // Remove memory
    this.memories.delete(id);

    return true;
  }

  /**
   * Search memories
   */
  searchMemories(query: MemoryQuery): MemoryEntry[] {
    let results = Array.from(this.memories.values());

    // Filter by type
    if (query.type) {
      const typeIds = this.typeIndex.get(query.type) || new Set();
      results = results.filter(m => typeIds.has(m.id));
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      const tagIds = new Set<string>();
      query.tags.forEach(tag => {
        const ids = this.tagsIndex.get(tag) || new Set();
        ids.forEach(id => tagIds.add(id));
      });
      results = results.filter(m => tagIds.has(m.id));
    }

    // Filter by importance
    if (query.importance) {
      const importanceOrder = ['low', 'medium', 'high', 'critical'];
      const minIndex = importanceOrder.indexOf(query.importance);
      results = results.filter(m => 
        importanceOrder.indexOf(m.importance) >= minIndex
      );
    }

    // Search in content
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      results = results.filter(m =>
        m.content.toLowerCase().includes(searchLower) ||
        m.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort
    const sortBy = query.sortBy || 'updatedAt';
    const sortOrder = query.sortOrder || 'desc';
    
    results.sort((a, b) => {
      const aVal = a[sortBy] || a.updatedAt;
      const bVal = b[sortBy] || b.updatedAt;
      
      if (sortOrder === 'asc') {
        return new Date(aVal).getTime() - new Date(bVal).getTime();
      } else {
        return new Date(bVal).getTime() - new Date(aVal).getTime();
      }
    });

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get memories by type
   */
  getMemoriesByType(type: MemoryType): MemoryEntry[] {
    const ids = this.typeIndex.get(type) || new Set();
    return Array.from(ids)
      .map(id => this.memories.get(id))
      .filter((m): m is MemoryEntry => m !== undefined);
  }

  /**
   * Get memories by tag
   */
  getMemoriesByTag(tag: string): MemoryEntry[] {
    const ids = this.tagsIndex.get(tag) || new Set();
    return Array.from(ids)
      .map(id => this.memories.get(id))
      .filter((m): m is MemoryEntry => m !== undefined);
  }

  /**
   * Get recent memories
   */
  getRecentMemories(limit: number = 10): MemoryEntry[] {
    return Array.from(this.memories.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Get important memories
   */
  getImportantMemories(limit: number = 10): MemoryEntry[] {
    const importanceOrder = ['critical', 'high', 'medium', 'low'];
    
    return Array.from(this.memories.values())
      .sort((a, b) => {
        const aIdx = importanceOrder.indexOf(a.importance);
        const bIdx = importanceOrder.indexOf(b.importance);
        return aIdx - bIdx;
      })
      .slice(0, limit);
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const memories = Array.from(this.memories.values());
    
    const byType: Record<MemoryType, number> = {
      decision: 0,
      learning: 0,
      relationship: 0,
      preference: 0,
      error: 0,
      success: 0,
      context: 0,
      custom: 0
    };

    const byImportance: Record<MemoryEntry['importance'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    let totalAccessCount = 0;
    let oldestEntry: string | undefined;
    let newestEntry: string | undefined;

    memories.forEach(m => {
      byType[m.type]++;
      byImportance[m.importance]++;
      totalAccessCount += m.accessCount;

      if (!oldestEntry || new Date(m.createdAt) < new Date(oldestEntry)) {
        oldestEntry = m.createdAt;
      }
      if (!newestEntry || new Date(m.createdAt) > new Date(newestEntry)) {
        newestEntry = m.createdAt;
      }
    });

    return {
      totalEntries: memories.length,
      byType,
      byImportance,
      totalAccessCount,
      averageAccessCount: memories.length > 0 ? totalAccessCount / memories.length : 0,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Export memories as JSON
   */
  exportMemories(): MemoryEntry[] {
    return Array.from(this.memories.values());
  }

  /**
   * Import memories from JSON
   */
  importMemories(memories: MemoryEntry[]): number {
    let imported = 0;

    memories.forEach(memory => {
      if (!this.memories.has(memory.id)) {
        this.memories.set(memory.id, memory);
        this.updateIndexes(memory);
        imported++;
      }
    });

    return imported;
  }

  /**
   * Cleanup old memories
   */
  cleanup(): number {
    const cutoff = Date.now() - this.config.cleanupMaxAgeMs;
    let cleaned = 0;

    this.memories.forEach((memory, id) => {
      const updatedAt = new Date(memory.updatedAt).getTime();
      
      // Only cleanup low importance memories that are old
      if (
        memory.importance === 'low' &&
        updatedAt < cutoff
      ) {
        this.deleteMemory(id);
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memories.clear();
    this.tagsIndex.clear();
    this.typeIndex.clear();
    this.initializeIndexes();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();
