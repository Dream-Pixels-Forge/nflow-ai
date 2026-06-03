/**
 * LearningManager - Continuous learning from agent mistakes
 * 
 * Tracks errors, generates learned patterns, and injects them into agent prompts
 * to prevent repeated mistakes.
 */

export interface LearningEntry {
  id: string;
  agentId: string;
  timestamp: number;
  errorType: 'code-error' | 'logic-error' | 'api-misuse' | 'scope-creep' | 'wrong-approach';
  description: string;
  lesson: string;
  context: string;
  timesEncountered: number;
  lastSeen: number;
}

export interface LearnedPattern {
  agentId: string;
  patterns: string[];
  totalErrors: number;
  recentErrors: LearningEntry[];
}

export interface LearningConfig {
  enabled: boolean;
  maxEntriesPerAgent: number;
  maxAge: number; // ms
  lessonExpiry: number; // ms - after this, lessons are forgotten
}

const DEFAULT_CONFIG: LearningConfig = {
  enabled: true,
  maxEntriesPerAgent: 50,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  lessonExpiry: 24 * 60 * 60 * 1000 // 24 hours
};

export class LearningManager {
  private entries: Map<string, LearningEntry> = new Map();
  private config: LearningConfig;

  constructor(config: Partial<LearningConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Record an error/mistake
   */
  recordError(
    agentId: string,
    errorType: LearningEntry['errorType'],
    description: string,
    lesson: string,
    context: string = ''
  ): LearningEntry {
    const id = `learn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const entry: LearningEntry = {
      id,
      agentId,
      timestamp: Date.now(),
      errorType,
      description,
      lesson,
      context,
      timesEncountered: 1,
      lastSeen: Date.now()
    };

    this.entries.set(id, entry);
    this.enforceLimit(agentId);
    
    return entry;
  }

  /**
   * Get learned patterns for an agent
   */
  getLearnedPatterns(agentId: string): LearnedPattern {
    const now = Date.now();
    const agentEntries = Array.from(this.entries.values())
      .filter(e => e.agentId === agentId)
      .filter(e => now - e.lastSeen < this.config.lessonExpiry);

    // Group by lesson
    const lessonMap = new Map<string, LearningEntry>();
    for (const entry of agentEntries) {
      const existing = lessonMap.get(entry.lesson);
      if (!existing || entry.timesEncountered > existing.timesEncountered) {
        lessonMap.set(entry.lesson, entry);
      }
    }

    // Sort by frequency and recency
    const sortedEntries = Array.from(lessonMap.values())
      .sort((a, b) => {
        // Prioritize frequently encountered
        if (b.timesEncountered !== a.timesEncountered) {
          return b.timesEncountered - a.timesEncountered;
        }
        // Then by recency
        return b.lastSeen - a.lastSeen;
      })
      .slice(0, 10); // Top 10 lessons

    return {
      agentId,
      patterns: sortedEntries.map(e => `[${e.errorType}] ${e.lesson}`),
      totalErrors: agentEntries.length,
      recentErrors: sortedEntries.slice(0, 3)
    };
  }

  /**
   * Format learned patterns for system prompt injection
   */
  formatForPrompt(agentId: string): string {
    const patterns = this.getLearnedPatterns(agentId);
    
    if (patterns.patterns.length === 0) {
      return '';
    }

    const lines = [
      '## Learned Patterns (from past mistakes)',
      'The following patterns were learned from previous errors. Avoid repeating these:',
      '',
      ...patterns.patterns.map((p, i) => `${i + 1}. ${p}`),
      '',
      `Total errors encountered: ${patterns.totalErrors}`
    ];

    return lines.join('\n');
  }

  /**
   * Check if a specific pattern has been encountered
   */
  hasPattern(agentId: string, pattern: string): boolean {
    const now = Date.now();
    return Array.from(this.entries.values())
      .some(e => 
        e.agentId === agentId &&
        e.lesson.toLowerCase().includes(pattern.toLowerCase()) &&
        now - e.lastSeen < this.config.lessonExpiry
      );
  }

  /**
   * Increment encounter count for a pattern
   */
  incrementEncounter(lesson: string, agentId?: string): boolean {
    for (const entry of this.entries.values()) {
      if (entry.lesson === lesson && (!agentId || entry.agentId === agentId)) {
        entry.timesEncountered++;
        entry.lastSeen = Date.now();
        return true;
      }
    }
    return false;
  }

  /**
   * Get all entries for an agent
   */
  getAgentEntries(agentId: string): LearningEntry[] {
    return Array.from(this.entries.values())
      .filter(e => e.agentId === agentId)
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEntries: number;
    byAgent: Record<string, number>;
    byErrorType: Record<string, number>;
    activeLessons: number;
  } {
    const entries = Array.from(this.entries.values());
    const now = Date.now();
    
    const byAgent: Record<string, number> = {};
    const byErrorType: Record<string, number> = {};
    
    let activeLessons = 0;
    
    for (const entry of entries) {
      byAgent[entry.agentId] = (byAgent[entry.agentId] || 0) + 1;
      byErrorType[entry.errorType] = (byErrorType[entry.errorType] || 0) + 1;
      
      if (now - entry.lastSeen < this.config.lessonExpiry) {
        activeLessons++;
      }
    }

    return {
      totalEntries: entries.length,
      byAgent,
      byErrorType,
      activeLessons
    };
  }

  /**
   * Enforce per-agent limit
   */
  private enforceLimit(agentId: string): void {
    const agentEntries = this.getAgentEntries(agentId);
    if (agentEntries.length > this.config.maxEntriesPerAgent) {
      // Remove oldest
      const toRemove = agentEntries.slice(this.config.maxEntriesPerAgent);
      for (const entry of toRemove) {
        this.entries.delete(entry.id);
      }
    }
  }

  /**
   * Cleanup old entries
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of this.entries) {
        if (now - entry.timestamp > this.config.maxAge) {
          this.entries.delete(id);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Clear entries for an agent
   */
  clearAgent(agentId: string): void {
    for (const [id, entry] of this.entries) {
      if (entry.agentId === agentId) {
        this.entries.delete(id);
      }
    }
  }
}

// Singleton instance
export const learningManager = new LearningManager();
