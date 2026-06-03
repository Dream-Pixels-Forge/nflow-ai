/**
 * AgentOrchestrator - Central coordinator for agent lifecycle management
 * 
 * Implements heartbeat monitoring, phase state machine, and agent cluster management
 * Based on PRIDES framework principles from Obsidian vault knowledge.
 */

export type AgentPhase = 'P' | 'R' | 'I' | 'D' | 'E' | 'S';

export type AgentStatus = 'HEALTHY' | 'DRIFTING' | 'STALLED' | 'CRASHED' | 'IDLE';

export interface HeartbeatPulse {
  timestamp: string;
  agentId: string;
  phase: AgentPhase;
  status: AgentStatus;
  currentIntent: string;
  lastReasoningHash: string;
  resourceUsage: {
    tokens: number;
    latencyMs: number;
  };
  ap2Balance?: number;
}

export interface AgentState {
  id: string;
  phase: AgentPhase;
  status: AgentStatus;
  currentIntent: string;
  lastPulseTime: number;
  pulseCount: number;
  driftCount: number;
  reasoningTraces: string[];
}

export interface PhaseConfig {
  phase: AgentPhase;
  name: string;
  heartbeatIntervalMs: number;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  timeoutMs: number;
}

// Phase configurations based on PRIDES framework
export const PHASE_CONFIGS: Record<AgentPhase, PhaseConfig> = {
  P: { phase: 'P', name: 'Prototype', heartbeatIntervalMs: 30000, criticality: 'high', timeoutMs: 300000 },
  R: { phase: 'R', name: 'Review', heartbeatIntervalMs: 120000, criticality: 'high', timeoutMs: 600000 },
  I: { phase: 'I', name: 'Implement', heartbeatIntervalMs: 30000, criticality: 'critical', timeoutMs: 300000 },
  D: { phase: 'D', name: 'Deploy', heartbeatIntervalMs: 60000, criticality: 'critical', timeoutMs: 600000 },
  E: { phase: 'E', name: 'Extend', heartbeatIntervalMs: 300000, criticality: 'medium', timeoutMs: 1800000 },
  S: { phase: 'S', name: 'Secure', heartbeatIntervalMs: 30000, criticality: 'critical', timeoutMs: 300000 },
};

// Valid phase transitions (P→R→I→D→E→S)
const VALID_TRANSITIONS: Record<AgentPhase, AgentPhase[]> = {
  P: ['R'],
  R: ['I', 'P'], // Can go back to P if review fails
  I: ['D', 'R'], // Can go back to R if implementation fails
  D: ['E', 'I'], // Can go back to I if deployment fails
  E: ['S', 'D'], // Can go back to D if extension fails
  S: ['E'], // Can go back to E if security fails
};

export class AgentOrchestrator {
  private agents: Map<string, AgentState> = new Map();
  private phaseTimers: Map<AgentPhase, NodeJS.Timeout> = new Map();
  private onPulseCallback?: (pulse: HeartbeatPulse) => void;
  private onDriftCallback?: (agentId: string, drift: string) => void;
  private onTimeoutCallback?: (agentId: string, phase: AgentPhase) => void;

  constructor() {
    this.initializeOrchestrator();
  }

  private initializeOrchestrator(): void {
    // Initialize default agent states for each mode
    const agentModes = ['CHAT', 'PLAN', 'ARCHITECT', 'CODER', 'TEST', 'SECURE', 'DEPLOY', 'MONITOR'];
    
    agentModes.forEach(mode => {
      this.agents.set(mode, {
        id: mode,
        phase: this.getPhaseForAgent(mode),
        status: 'IDLE',
        currentIntent: '',
        lastPulseTime: Date.now(),
        pulseCount: 0,
        driftCount: 0,
        reasoningTraces: []
      });
    });
  }

  private getPhaseForAgent(agentId: string): AgentPhase {
    const phaseMap: Record<string, AgentPhase> = {
      'CHAT': 'P',
      'PLAN': 'P',
      'ARCHITECT': 'R',
      'CODER': 'I',
      'TEST': 'I',
      'SECURE': 'S',
      'DEPLOY': 'D',
      'MONITOR': 'E'
    };
    return phaseMap[agentId] || 'P';
  }

  /**
   * Register callbacks for orchestrator events
   */
  onPulse(callback: (pulse: HeartbeatPulse) => void): void {
    this.onPulseCallback = callback;
  }

  onDrift(callback: (agentId: string, drift: string) => void): void {
    this.onDriftCallback = callback;
  }

  onTimeout(callback: (agentId: string, phase: AgentPhase) => void): void {
    this.onTimeoutCallback = callback;
  }

  /**
   * Start heartbeat monitoring for an agent
   */
  startHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const config = PHASE_CONFIGS[agent.phase];
    
    // Clear existing timer
    const existingTimer = this.phaseTimers.get(agent.phase);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Set new heartbeat timer
    const timer = setInterval(() => {
      this.checkAgentHealth(agentId);
    }, config.heartbeatIntervalMs);

    this.phaseTimers.set(agent.phase, timer);
    
    // Update agent status
    agent.status = 'HEALTHY';
    agent.lastPulseTime = Date.now();
  }

  /**
   * Stop heartbeat monitoring for an agent
   */
  stopHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const timer = this.phaseTimers.get(agent.phase);
    if (timer) {
      clearInterval(timer);
      this.phaseTimers.delete(agent.phase);
    }

    agent.status = 'IDLE';
  }

  /**
   * Record a heartbeat pulse from an agent
   */
  recordPulse(pulse: HeartbeatPulse): void {
    const agent = this.agents.get(pulse.agentId);
    if (!agent) return;

    // Update agent state
    agent.lastPulseTime = Date.now();
    agent.pulseCount++;
    agent.currentIntent = pulse.currentIntent;
    agent.status = pulse.status;

    // Store reasoning trace
    if (pulse.lastReasoningHash) {
      agent.reasoningTraces.push(pulse.lastReasoningHash);
      // Keep only last 10 traces
      if (agent.reasoningTraces.length > 10) {
        agent.reasoningTraces.shift();
      }
    }

    // Check for behavioral drift
    this.checkForDrift(agent);

    // Emit pulse event
    if (this.onPulseCallback) {
      this.onPulseCallback(pulse);
    }
  }

  /**
   * Check agent health based on heartbeat timing
   */
  private checkAgentHealth(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status === 'IDLE') return;

    const config = PHASE_CONFIGS[agent.phase];
    const timeSinceLastPulse = Date.now() - agent.lastPulseTime;

    // Check for timeout (hard failure)
    if (timeSinceLastPulse > config.timeoutMs) {
      agent.status = 'CRASHED';
      if (this.onTimeoutCallback) {
        this.onTimeoutCallback(agentId, agent.phase);
      }
      return;
    }

    // Check for stalled (no pulse for 2x interval)
    if (timeSinceLastPulse > config.heartbeatIntervalMs * 2) {
      agent.status = 'STALLED';
    }
  }

  /**
   * Check for behavioral drift
   */
  private checkForDrift(agent: AgentState): void {
    // Simple drift detection based on intent changes
    // In production, this would compare against Phase P constraints
    const recentTraces = agent.reasoningTraces.slice(-5);
    
    // If too many recent traces, might be drifting
    if (recentTraces.length >= 5) {
      agent.driftCount++;
      agent.status = 'DRIFTING';
      
      if (this.onDriftCallback) {
        this.onDriftCallback(agent.id, 'Excessive reasoning traces detected');
      }
    }
  }

  /**
   * Transition agent to new phase
   */
  transitionPhase(agentId: string, targetPhase: AgentPhase): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // Check if transition is valid
    const validTransitions = VALID_TRANSITIONS[agent.phase];
    if (!validTransitions.includes(targetPhase)) {
      console.error(`Invalid phase transition: ${agent.phase} → ${targetPhase}`);
      return false;
    }

    // Stop current heartbeat
    this.stopHeartbeat(agentId);

    // Update phase
    agent.phase = targetPhase;
    agent.status = 'HEALTHY';
    agent.driftCount = 0;

    // Start new heartbeat
    this.startHeartbeat(agentId);

    return true;
  }

  /**
   * Get current state of all agents
   */
  getAgentStates(): Map<string, AgentState> {
    return new Map(this.agents);
  }

  /**
   * Get state of specific agent
   */
  getAgentState(agentId: string): AgentState | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get phase configuration
   */
  getPhaseConfig(phase: AgentPhase): PhaseConfig {
    return PHASE_CONFIGS[phase];
  }

  /**
   * Check if phase transition is valid
   */
  isValidTransition(from: AgentPhase, to: AgentPhase): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Get all agents in a specific phase
   */
  getAgentsByPhase(phase: AgentPhase): AgentState[] {
    return Array.from(this.agents.values()).filter(agent => agent.phase === phase);
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: AgentStatus): AgentState[] {
    return Array.from(this.agents.values()).filter(agent => agent.status === status);
  }

  /**
   * Cleanup orchestrator
   */
  destroy(): void {
    // Clear all timers
    this.phaseTimers.forEach(timer => clearInterval(timer));
    this.phaseTimers.clear();
    this.agents.clear();
  }
}

// Singleton instance
export const agentOrchestrator = new AgentOrchestrator();
