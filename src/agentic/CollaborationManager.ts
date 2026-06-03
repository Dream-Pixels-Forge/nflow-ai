/**
 * CollaborationManager - Proactive agent collaboration
 * 
 * Monitors agent activity and proactively suggests when another agent
 * could help, preventing bottlenecks and improving workflow.
 */

import { AgentMode } from '../../types';

export interface CollaborationSignal {
  id: string;
  timestamp: number;
  sourceAgent: AgentMode;
  targetAgent: AgentMode;
  reason: string;
  confidence: number; // 0-1
  type: 'expertise-match' | 'error-pattern' | 'task-dependency' | 'bottleneck';
}

export interface CollaborationSuggestion {
  id: string;
  timestamp: number;
  message: string;
  fromAgent: AgentMode;
  toAgent: AgentMode;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  dismissed: boolean;
}

export interface CollaborationConfig {
  enabled: boolean;
  maxSuggestions: number;
  suggestionCooldown: number; // ms between suggestions per agent pair
  autoSuggestThreshold: number; // confidence threshold for auto-suggest
}

const DEFAULT_CONFIG: CollaborationConfig = {
  enabled: true,
  maxSuggestions: 5,
  suggestionCooldown: 60000, // 1 minute
  autoSuggestThreshold: 0.7
};

// Agent expertise mapping
const AGENT_EXPERTISE: Record<AgentMode, string[]> = {
  [AgentMode.CHAT]: ['general', 'planning', 'coordination', 'brainstorming'],
  [AgentMode.PLAN]: ['requirements', 'user-stories', 'roadmap', 'acceptance-criteria'],
  [AgentMode.ARCHITECT]: ['system-design', 'scalability', 'patterns', 'data-flow', 'structure'],
  [AgentMode.CODER]: ['implementation', 'typescript', 'react', 'node', 'api', 'database'],
  [AgentMode.TEST]: ['testing', 'qa', 'coverage', 'mocking', 'integration-tests', 'unit-tests'],
  [AgentMode.SECURE]: ['security', 'vulnerabilities', 'auth', 'encryption', 'owasp'],
  [AgentMode.DEPLOY]: ['deployment', 'ci-cd', 'docker', 'aws', 'vercel', 'terraform'],
  [AgentMode.MONITOR]: ['monitoring', 'logging', 'performance', 'metrics', 'health']
};

// Error patterns that suggest peer help
const ERROR_PATTERNS: { pattern: string; suggestAgent: AgentMode; reason: string }[] = [
  { pattern: 'test failed', suggestAgent: AgentMode.TEST, reason: 'Test failures may need QA review' },
  { pattern: 'security', suggestAgent: AgentMode.SECURE, reason: 'Security concerns should be reviewed' },
  { pattern: 'deploy', suggestAgent: AgentMode.DEPLOY, reason: 'Deployment issues need DevOps' },
  { pattern: 'performance', suggestAgent: AgentMode.MONITOR, reason: 'Performance issues need monitoring' },
  { pattern: 'architecture', suggestAgent: AgentMode.ARCHITECT, reason: 'Design decisions need architecture review' },
  { pattern: 'requirements', suggestAgent: AgentMode.PLAN, reason: 'Unclear requirements need planning' }
];

export class CollaborationManager {
  private signals: CollaborationSignal[] = [];
  private suggestions: CollaborationSuggestion[] = [];
  private config: CollaborationConfig;
  private lastSuggestionTime: Map<string, number> = new Map();
  private onSuggestionCallback?: (suggestion: CollaborationSuggestion) => void;

  constructor(config: Partial<CollaborationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register callback for new suggestions
   */
  onSuggestion(callback: (suggestion: CollaborationSuggestion) => void): void {
    this.onSuggestionCallback = callback;
  }

  /**
   * Analyze agent message for collaboration signals
   */
  analyzeMessage(agentId: AgentMode, message: string): CollaborationSignal[] {
    const newSignals: CollaborationSignal[] = [];
    const lowerMessage = message.toLowerCase();

    // Check for expertise matches
    for (const [targetAgent, keywords] of Object.entries(AGENT_EXPERTISE)) {
      if (targetAgent === agentId) continue;
      
      const matchCount = keywords.filter(kw => lowerMessage.includes(kw)).length;
      const confidence = Math.min(matchCount / 3, 1); // 3+ keywords = high confidence
      
      if (confidence > 0.3) {
        const signal: CollaborationSignal = {
          id: `signal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
          sourceAgent: agentId,
          targetAgent: targetAgent as AgentMode,
          reason: `Message discusses ${keywords.filter(kw => lowerMessage.includes(kw)).join(', ')}`,
          confidence,
          type: 'expertise-match'
        };
        newSignals.push(signal);
      }
    }

    // Check for error patterns
    for (const { pattern, suggestAgent, reason } of ERROR_PATTERNS) {
      if (lowerMessage.includes(pattern) && suggestAgent !== agentId) {
        const signal: CollaborationSignal = {
          id: `signal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
          sourceAgent: agentId,
          targetAgent: suggestAgent,
          reason,
          confidence: 0.8,
          type: 'error-pattern'
        };
        newSignals.push(signal);
      }
    }

    this.signals.push(...newSignals);
    this.enforceLimit();
    
    return newSignals;
  }

  /**
   * Generate collaboration suggestions based on signals
   */
  generateSuggestions(agentId: AgentMode): CollaborationSuggestion[] {
    const newSuggestions: CollaborationSuggestion[] = [];
    const now = Date.now();

    // Get recent signals for this agent
    const recentSignals = this.signals
      .filter(s => s.sourceAgent === agentId && now - s.timestamp < 300000) // Last 5 minutes
      .sort((a, b) => b.confidence - a.confidence);

    // Group by target agent
    const signalsByTarget = new Map<AgentMode, CollaborationSignal[]>();
    for (const signal of recentSignals) {
      const existing = signalsByTarget.get(signal.targetAgent) || [];
      existing.push(signal);
      signalsByTarget.set(signal.targetAgent, existing);
    }

    // Generate suggestions for high-confidence targets
    for (const [targetAgent, signals] of signalsByTarget) {
      const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
      
      if (avgConfidence < this.config.autoSuggestThreshold) continue;

      // Check cooldown
      const cooldownKey = `${agentId}-${targetAgent}`;
      const lastTime = this.lastSuggestionTime.get(cooldownKey) || 0;
      if (now - lastTime < this.config.suggestionCooldown) continue;

      const suggestion: CollaborationSuggestion = {
        id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: now,
        message: `Consider involving ${targetAgent} agent`,
        fromAgent: agentId,
        toAgent: targetAgent,
        reason: signals[0].reason,
        priority: avgConfidence > 0.8 ? 'high' : 'medium',
        dismissed: false
      };

      newSuggestions.push(suggestion);
      this.lastSuggestionTime.set(cooldownKey, now);
    }

    this.suggestions.push(...newSuggestions);
    this.enforceSuggestionLimit();

    // Notify callback
    for (const suggestion of newSuggestions) {
      if (this.onSuggestionCallback) {
        this.onSuggestionCallback(suggestion);
      }
    }

    return newSuggestions;
  }

  /**
   * Get active suggestions for an agent
   */
  getActiveSuggestions(agentId: AgentMode): CollaborationSuggestion[] {
    return this.suggestions
      .filter(s => 
        (s.fromAgent === agentId || s.toAgent === agentId) && 
        !s.dismissed &&
        Date.now() - s.timestamp < 600000 // Last 10 minutes
      )
      .sort((a, b) => b.priority.localeCompare(a.priority));
  }

  /**
   * Dismiss a suggestion
   */
  dismissSuggestion(suggestionId: string): boolean {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    if (suggestion) {
      suggestion.dismissed = true;
      return true;
    }
    return false;
  }

  /**
   * Get collaboration stats
   */
  getStats(): {
    totalSignals: number;
    activeSuggestions: number;
    byAgent: Record<string, number>;
    byType: Record<string, number>;
  } {
    const now = Date.now();
    const activeSuggestions = this.suggestions.filter(s => !s.dismissed && now - s.timestamp < 600000);
    
    const byAgent: Record<string, number> = {};
    const byType: Record<string, number> = {};
    
    for (const signal of this.signals) {
      byAgent[signal.sourceAgent] = (byAgent[signal.sourceAgent] || 0) + 1;
      byType[signal.type] = (byType[signal.type] || 0) + 1;
    }

    return {
      totalSignals: this.signals.length,
      activeSuggestions: activeSuggestions.length,
      byAgent,
      byType
    };
  }

  /**
   * Enforce signal limit
   */
  private enforceLimit(): void {
    if (this.signals.length > 1000) {
      this.signals = this.signals.slice(-500);
    }
  }

  /**
   * Enforce suggestion limit
   */
  private enforceSuggestionLimit(): void {
    if (this.suggestions.length > this.config.maxSuggestions * 10) {
      this.suggestions = this.suggestions.slice(-this.config.maxSuggestions * 5);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.signals = [];
    this.suggestions = [];
    this.lastSuggestionTime.clear();
  }
}

// Singleton instance
export const collaborationManager = new CollaborationManager();
