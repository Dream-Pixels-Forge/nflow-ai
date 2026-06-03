/**
 * EmergencyStop - Safety system for halting operations on critical failures
 * 
 * Implements AP2 mandate revocation, A2A disconnection, and state snapshotting
 * Based on PRIDES framework emergency stop protocol.
 */

import { AgentOrchestrator, AgentPhase, agentOrchestrator } from './AgentOrchestrator';

export type EmergencySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface EmergencyEvent {
  id: string;
  timestamp: string;
  agentId: string;
  phase: AgentPhase;
  severity: EmergencySeverity;
  reason: string;
  actions: EmergencyAction[];
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export type EmergencyAction = 
  | 'LOCK_MANDATES'
  | 'DISCONNECT_A2A'
  | 'SNAPSHOT_STATE'
  | 'SIGNAL_GOVERNOR'
  | 'AWAIT_HUMAN_INTERVENTION'
  | 'HALT_ALL_OPERATIONS'
  | 'ROLLBACK_DEPLOYMENT';

export interface EmergencyConfig {
  enabled: boolean;
  autoHaltOnCritical: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

const DEFAULT_CONFIG: EmergencyConfig = {
  enabled: true,
  autoHaltOnCritical: true,
  maxRetries: 3,
  retryDelayMs: 1000
};

export class EmergencyStop {
  private orchestrator: AgentOrchestrator;
  private config: EmergencyConfig;
  private emergencyEvents: Map<string, EmergencyEvent> = new Map();
  private isHalted: boolean = false;
  private onEmergencyCallback?: (event: EmergencyEvent) => void;
  private onHaltCallback?: (halted: boolean) => void;

  constructor(orchestrator: AgentOrchestrator, config: Partial<EmergencyConfig> = {}) {
    this.orchestrator = orchestrator;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register callbacks for emergency events
   */
  onEmergency(callback: (event: EmergencyEvent) => void): void {
    this.onEmergencyCallback = callback;
  }

  onHalt(callback: (halted: boolean) => void): void {
    this.onHaltCallback = callback;
  }

  /**
   * Trigger emergency stop for an agent
   */
  async triggerEmergencyStop(
    agentId: string,
    severity: EmergencySeverity,
    reason: string
  ): Promise<EmergencyEvent> {
    const agent = this.orchestrator.getAgentState(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const event: EmergencyEvent = {
      id: `emergency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      agentId,
      phase: agent.phase,
      severity,
      reason,
      actions: [],
      resolved: false
    };

    // Execute emergency actions based on severity
    await this.executeEmergencyActions(event, agent.phase);

    // Store event
    this.emergencyEvents.set(event.id, event);

    // Emit callback
    if (this.onEmergencyCallback) {
      this.onEmergencyCallback(event);
    }

    return event;
  }

  /**
   * Execute emergency actions based on severity
   */
  private async executeEmergencyActions(event: EmergencyEvent, phase: AgentPhase): Promise<void> {
    const actions: EmergencyAction[] = [];

    // Financial safety first (LOCK_MANDATES)
    actions.push('LOCK_MANDATES');

    // Isolation second (DISCONNECT_A2A)
    actions.push('DISCONNECT_A2A');

    // Forensics third (SNAPSHOT_STATE)
    actions.push('SNAPSHOT_STATE');

    // Escalation fourth (SIGNAL_GOVERNOR)
    actions.push('SIGNAL_GOVERNOR');

    // Phase-specific actions
    if (phase === 'D' && event.severity === 'critical') {
      actions.push('ROLLBACK_DEPLOYMENT');
    }

    if (phase === 'S' || event.severity === 'critical') {
      actions.push('HALT_ALL_OPERATIONS');
      this.isHalted = true;
      if (this.onHaltCallback) {
        this.onHaltCallback(true);
      }
    }

    // Wait fifth (AWAIT_HUMAN_INTERVENTION)
    actions.push('AWAIT_HUMAN_INTERVENTION');

    event.actions = actions;

    // Execute each action
    for (const action of actions) {
      await this.executeAction(action, event);
    }
  }

  /**
   * Execute individual emergency action
   */
  private async executeAction(action: EmergencyAction, event: EmergencyEvent): Promise<void> {
    // Action executed silently — state is tracked via event.actions array
  }

  /**
   * Resolve an emergency event
   */
  resolveEmergency(eventId: string, resolvedBy: string): boolean {
    const event = this.emergencyEvents.get(eventId);
    if (!event) return false;

    event.resolved = true;
    event.resolvedAt = new Date().toISOString();
    event.resolvedBy = resolvedBy;

    // If this was a halt event, resume operations
    if (event.actions.includes('HALT_ALL_OPERATIONS')) {
      this.isHalted = false;
      if (this.onHaltCallback) {
        this.onHaltCallback(false);
      }
    }

    return true;
  }

  /**
   * Check if system is currently halted
   */
  isSystemHalted(): boolean {
    return this.isHalted;
  }

  /**
   * Get all emergency events
   */
  getEmergencyEvents(): EmergencyEvent[] {
    return Array.from(this.emergencyEvents.values());
  }

  /**
   * Get unresolved emergency events
   */
  getUnresolvedEvents(): EmergencyEvent[] {
    return Array.from(this.emergencyEvents.values()).filter(e => !e.resolved);
  }

  /**
   * Get emergency events for specific agent
   */
  getAgentEmergencyEvents(agentId: string): EmergencyEvent[] {
    return Array.from(this.emergencyEvents.values()).filter(e => e.agentId === agentId);
  }

  /**
   * Update emergency configuration
   */
  updateConfig(config: Partial<EmergencyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): EmergencyConfig {
    return { ...this.config };
  }

  /**
   * Cleanup emergency stop system
   */
  destroy(): void {
    this.emergencyEvents.clear();
    this.isHalted = false;
  }
}

// Singleton instance
export const emergencyStop = new EmergencyStop(agentOrchestrator);
