/**
 * BehavioralDrift - Detection system for identifying agent deviation from intended behavior
 * 
 * Implements intent monitoring, reasoning trace analysis, and drift detection
 * Based on PRIDES framework behavioral drift concepts.
 */

import { AgentOrchestrator, AgentPhase, AgentState, agentOrchestrator } from './AgentOrchestrator';

export type DriftSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DriftEvent {
  id: string;
  timestamp: string;
  agentId: string;
  phase: AgentPhase;
  severity: DriftSeverity;
  type: DriftType;
  description: string;
  originalIntent: string;
  currentIntent: string;
  reasoningTraces: string[];
  resolved: boolean;
  resolvedAt?: string;
  resolution?: string;
}

export type DriftType = 
  | 'INTENT_DEVIATION'
  | 'REASONING_INCONSISTENCY'
  | 'CONSTRAINT_VIOLATION'
  | 'SCOPE_CREEP'
  | 'RESOURCE_MISUSE';

export interface PhaseConstraintSet {
  phase: AgentPhase;
  constraints: string[];
  allowedIntents: string[];
  maxTokens: number;
  maxLatencyMs: number;
}

export interface DriftConfig {
  enabled: boolean;
  checkIntervalMs: number;
  maxDriftTolerance: number;
  autoRealign: boolean;
  alertThreshold: number;
}

const DEFAULT_CONFIG: DriftConfig = {
  enabled: true,
  checkIntervalMs: 10000,
  maxDriftTolerance: 3,
  autoRealign: true,
  alertThreshold: 2
};

// Default phase constraints (would be defined during Phase P)
const DEFAULT_PHASE_CONSTRAINTS: Record<AgentPhase, PhaseConstraintSet> = {
  P: {
    phase: 'P',
    constraints: ['Ideation', 'Validation', 'Planning'],
    allowedIntents: ['brainstorm', 'research', 'plan', 'document'],
    maxTokens: 10000,
    maxLatencyMs: 5000
  },
  R: {
    phase: 'R',
    constraints: ['Analysis', 'Approval', 'Quality Gates'],
    allowedIntents: ['review', 'analyze', 'approve', 'reject'],
    maxTokens: 8000,
    maxLatencyMs: 3000
  },
  I: {
    phase: 'I',
    constraints: ['Build', 'Test', 'Verify'],
    allowedIntents: ['implement', 'test', 'debug', 'refactor'],
    maxTokens: 15000,
    maxLatencyMs: 10000
  },
  D: {
    phase: 'D',
    constraints: ['Release', 'Verify', 'Monitor'],
    allowedIntents: ['deploy', 'release', 'monitor', 'rollback'],
    maxTokens: 5000,
    maxLatencyMs: 20000
  },
  E: {
    phase: 'E',
    constraints: ['Enhance', 'Scale', 'Optimize'],
    allowedIntents: ['extend', 'optimize', 'scale', 'enhance'],
    maxTokens: 12000,
    maxLatencyMs: 8000
  },
  S: {
    phase: 'S',
    constraints: ['Harden', 'Monitor', 'Respond'],
    allowedIntents: ['secure', 'audit', 'monitor', 'respond'],
    maxTokens: 8000,
    maxLatencyMs: 5000
  }
};

export class BehavioralDrift {
  private orchestrator: AgentOrchestrator;
  private config: DriftConfig;
  private phaseConstraints: Map<AgentPhase, PhaseConstraintSet>;
  private driftEvents: Map<string, DriftEvent> = new Map();
  private agentIntents: Map<string, string[]> = new Map();
  private checkTimer?: NodeJS.Timeout;
  private onDriftCallback?: (event: DriftEvent) => void;
  private onRealignCallback?: (agentId: string) => void;

  constructor(orchestrator: AgentOrchestrator, config: Partial<DriftConfig> = {}) {
    this.orchestrator = orchestrator;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.phaseConstraints = new Map(Object.entries(DEFAULT_PHASE_CONSTRAINTS) as [AgentPhase, PhaseConstraintSet][]);
  }

  /**
   * Register callbacks for drift events
   */
  onDrift(callback: (event: DriftEvent) => void): void {
    this.onDriftCallback = callback;
  }

  onRealign(callback: (agentId: string) => void): void {
    this.onRealignCallback = callback;
  }

  /**
   * Start drift monitoring
   */
  startMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(() => {
      this.checkAllAgents();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop drift monitoring
   */
  stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  /**
   * Check all agents for drift
   */
  private checkAllAgents(): void {
    if (!this.config.enabled) return;

    const agents = this.orchestrator.getAgentStates();
    agents.forEach((agent, agentId) => {
      if (agent.status !== 'IDLE') {
        this.checkAgentForDrift(agentId, agent);
      }
    });
  }

  /**
   * Check specific agent for drift
   */
  private checkAgentForDrift(agentId: string, agent: AgentState): void {
    const constraints = this.phaseConstraints.get(agent.phase);
    if (!constraints) return;

    // Track intent history
    if (!this.agentIntents.has(agentId)) {
      this.agentIntents.set(agentId, []);
    }

    const intentHistory = this.agentIntents.get(agentId)!;
    const currentIntent = agent.currentIntent;

    // Add current intent to history
    if (currentIntent && (intentHistory.length === 0 || intentHistory[intentHistory.length - 1] !== currentIntent)) {
      intentHistory.push(currentIntent);
      // Keep only last 10 intents
      if (intentHistory.length > 10) {
        intentHistory.shift();
      }
    }

    // Check for intent deviation
    if (currentIntent && !this.isIntentAllowed(currentIntent, constraints)) {
      this.createDriftEvent(agentId, agent, 'INTENT_DEVIATION', 
        `Intent "${currentIntent}" not in allowed list for phase ${agent.phase}`,
        intentHistory[intentHistory.length - 2] || '',
        currentIntent
      );
    }

    // Check for scope creep (too many intent changes)
    if (intentHistory.length >= 5) {
      const uniqueIntents = new Set(intentHistory.slice(-5));
      if (uniqueIntents.size >= 4) {
        this.createDriftEvent(agentId, agent, 'SCOPE_CREEP',
          'Too many intent changes detected - possible scope creep',
          intentHistory[0],
          currentIntent
        );
      }
    }

    // Check for reasoning inconsistency
    if (agent.reasoningTraces.length >= 5) {
      const recentTraces = agent.reasoningTraces.slice(-5);
      const uniqueTraces = new Set(recentTraces);
      if (uniqueTraces.size < recentTraces.length) {
        this.createDriftEvent(agentId, agent, 'REASONING_INCONSISTENCY',
          'Duplicate reasoning traces detected - possible reasoning loop',
          '',
          currentIntent
        );
      }
    }
  }

  /**
   * Check if intent is allowed for current phase
   */
  private isIntentAllowed(intent: string, constraints: PhaseConstraintSet): boolean {
    const lowerIntent = intent.toLowerCase();
    return constraints.allowedIntents.some(allowed => 
      lowerIntent.includes(allowed.toLowerCase())
    );
  }

  /**
   * Create a drift event
   */
  private createDriftEvent(
    agentId: string,
    agent: AgentState,
    type: DriftType,
    description: string,
    originalIntent: string,
    currentIntent: string
  ): void {
    const severity = this.calculateDriftSeverity(type, agent.driftCount);

    const event: DriftEvent = {
      id: `drift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      agentId,
      phase: agent.phase,
      severity,
      type,
      description,
      originalIntent,
      currentIntent,
      reasoningTraces: [...agent.reasoningTraces],
      resolved: false
    };

    // Store event
    this.driftEvents.set(event.id, event);

    // Update agent drift count
    agent.driftCount++;

    // Emit callback
    if (this.onDriftCallback) {
      this.onDriftCallback(event);
    }

    // Auto-realign if enabled and drift is not critical
    if (this.config.autoRealign && severity !== 'critical') {
      this.realignAgent(agentId);
    }
  }

  /**
   * Calculate drift severity based on type and drift count
   */
  private calculateDriftSeverity(type: DriftType, driftCount: number): DriftSeverity {
    // Base severity by type
    const baseSeverity: Record<DriftType, DriftSeverity> = {
      'INTENT_DEVIATION': 'medium',
      'REASONING_INCONSISTENCY': 'high',
      'CONSTRAINT_VIOLATION': 'critical',
      'SCOPE_CREEP': 'medium',
      'RESOURCE_MISUSE': 'high'
    };

    const base = baseSeverity[type];

    // Escalate if repeated drifts
    if (driftCount >= this.config.maxDriftTolerance) {
      return 'critical';
    }

    if (driftCount >= this.config.alertThreshold) {
      // Escalate by one level
      const levels: DriftSeverity[] = ['low', 'medium', 'high', 'critical'];
      const currentIndex = levels.indexOf(base);
      return levels[Math.min(currentIndex + 1, levels.length - 1)];
    }

    return base;
  }

  /**
   * Realign agent to original intent
   */
  private realignAgent(agentId: string): void {
    // Clear intent history for this agent
    this.agentIntents.delete(agentId);
    
    // Emit realign callback
    if (this.onRealignCallback) {
      this.onRealignCallback(agentId);
    }
  }

  /**
   * Resolve a drift event
   */
  resolveDriftEvent(eventId: string, resolution: string): boolean {
    const event = this.driftEvents.get(eventId);
    if (!event) return false;

    event.resolved = true;
    event.resolvedAt = new Date().toISOString();
    event.resolution = resolution;

    return true;
  }

  /**
   * Set phase constraints (called during Phase P)
   */
  setPhaseConstraints(phase: AgentPhase, constraints: PhaseConstraintSet): void {
    this.phaseConstraints.set(phase, constraints);
  }

  /**
   * Get phase constraints
   */
  getPhaseConstraints(phase: AgentPhase): PhaseConstraintSet | undefined {
    return this.phaseConstraints.get(phase);
  }

  /**
   * Get all drift events
   */
  getDriftEvents(): DriftEvent[] {
    return Array.from(this.driftEvents.values());
  }

  /**
   * Get unresolved drift events
   */
  getUnresolvedEvents(): DriftEvent[] {
    return Array.from(this.driftEvents.values()).filter(e => !e.resolved);
  }

  /**
   * Get drift events for specific agent
   */
  getAgentDriftEvents(agentId: string): DriftEvent[] {
    return Array.from(this.driftEvents.values()).filter(e => e.agentId === agentId);
  }

  /**
   * Update drift configuration
   */
  updateConfig(config: Partial<DriftConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): DriftConfig {
    return { ...this.config };
  }

  /**
   * Cleanup drift detection system
   */
  destroy(): void {
    this.stopMonitoring();
    this.driftEvents.clear();
    this.agentIntents.clear();
  }
}

// Singleton instance
export const behavioralDrift = new BehavioralDrift(agentOrchestrator);
