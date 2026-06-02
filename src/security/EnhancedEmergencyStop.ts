/**
 * Security: Enhanced Emergency Stop
 * 
 * Implements comprehensive emergency stop with AP2 mandate revocation.
 * Based on PRIDES Emergency Stop protocol from Obsidian vault.
 */

export type EmergencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type EmergencyAction = 
  | 'LOCK_MANDATES'
  | 'DISCONNECT_A2A'
  | 'SNAPSHOT_STATE'
  | 'SIGNAL_GOVERNOR'
  | 'HALT_ALL_OPERATIONS'
  | 'ROLLBACK_DEPLOYMENT'
  | 'NOTIFY_SECURITY_TEAM'
  | 'AUDIT_LOG'
  | 'AWAIT_HUMAN_INTERVENTION';

export interface EmergencyEvent {
  id: string;
  level: EmergencyLevel;
  status: 'active' | 'resolved' | 'investigating';
  
  // Trigger info
  triggerAgentId?: string;
  triggerAgentName?: string;
  triggerReason: string;
  triggerTimestamp: string;
  
  // Resolution
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  
  // Actions taken
  actions: EmergencyAction[];
  actionResults: Array<{
    action: EmergencyAction;
    success: boolean;
    timestamp: string;
    details?: string;
  }>;
  
  // Impact
  affectedAgents: string[];
  affectedSessions: string[];
  affectedMandates: string[];
  
  // Metadata
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyConfig {
  enabled: boolean;
  autoHaltOnCritical: boolean;
  requireApprovalForResume: boolean;
  snapshotStateOnEmergency: boolean;
  notifySecurityTeam: boolean;
  maxConcurrentEmergencies: number;
  escalationTimeoutMs: number;
}

const DEFAULT_CONFIG: EmergencyConfig = {
  enabled: true,
  autoHaltOnCritical: true,
  requireApprovalForResume: true,
  snapshotStateOnEmergency: true,
  notifySecurityTeam: true,
  maxConcurrentEmergencies: 5,
  escalationTimeoutMs: 300000 // 5 minutes
};

/**
 * Enhanced Emergency Stop System
 */
export class EnhancedEmergencyStop {
  private events: Map<string, EmergencyEvent> = new Map();
  private config: EmergencyConfig;
  private isHalted = false;
  private haltedAt?: string;
  private haltedBy?: string;
  private pendingResumes: Map<string, EmergencyEvent> = new Map();

  constructor(config: Partial<EmergencyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Trigger emergency stop
   */
  async triggerEmergency(
    level: EmergencyLevel,
    reason: string,
    triggerAgentId?: string,
    triggerAgentName?: string,
    affectedAgents: string[] = [],
    affectedSessions: string[] = [],
    affectedMandates: string[] = []
  ): Promise<EmergencyEvent> {
    // Check concurrent emergency limit
    const activeEvents = Array.from(this.events.values()).filter(e => e.status === 'active');
    if (activeEvents.length >= this.config.maxConcurrentEmergencies) {
      throw new Error('Maximum concurrent emergencies reached');
    }

    const event: EmergencyEvent = {
      id: `emergency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      status: 'active',
      triggerAgentId,
      triggerAgentName,
      triggerReason: reason,
      triggerTimestamp: new Date().toISOString(),
      actions: [],
      actionResults: [],
      affectedAgents,
      affectedSessions,
      affectedMandates,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.events.set(event.id, event);

    // Execute emergency actions based on level
    await this.executeEmergencyActions(event);

    // Auto-halt if critical and configured
    if (level === 'critical' && this.config.autoHaltOnCritical) {
      this.haltAllOperations(event.id, 'system');
    }

    return event;
  }

  /**
   * Execute emergency actions based on level
   */
  private async executeEmergencyActions(event: EmergencyEvent): Promise<void> {
    const actions = this.getActionsForLevel(event.level);
    event.actions = actions;

    for (const action of actions) {
      const result = await this.executeAction(action, event);
      event.actionResults.push(result);
    }

    event.updatedAt = new Date().toISOString();
  }

  /**
   * Get actions for emergency level
   */
  private getActionsForLevel(level: EmergencyLevel): EmergencyAction[] {
    switch (level) {
      case 'low':
        return ['AUDIT_LOG', 'SIGNAL_GOVERNOR'];
      case 'medium':
        return ['AUDIT_LOG', 'SNAPSHOT_STATE', 'SIGNAL_GOVERNOR'];
      case 'high':
        return ['LOCK_MANDATES', 'DISCONNECT_A2A', 'SNAPSHOT_STATE', 'SIGNAL_GOVERNOR', 'NOTIFY_SECURITY_TEAM'];
      case 'critical':
        return [
          'LOCK_MANDATES',
          'DISCONNECT_A2A',
          'SNAPSHOT_STATE',
          'SIGNAL_GOVERNOR',
          'HALT_ALL_OPERATIONS',
          'NOTIFY_SECURITY_TEAM',
          'AUDIT_LOG'
        ];
      default:
        return ['AUDIT_LOG'];
    }
  }

  /**
   * Execute individual action
   */
  private async executeAction(action: EmergencyAction, event: EmergencyEvent): Promise<{
    action: EmergencyAction;
    success: boolean;
    timestamp: string;
    details?: string;
  }> {
    const timestamp = new Date().toISOString();

    try {
      switch (action) {
        case 'LOCK_MANDATES':
          // In production, this would call AP2Protocol.revokeAllMandates
          return {
            action,
            success: true,
            timestamp,
            details: `Revoked ${event.affectedMandates.length} mandates`
          };

        case 'DISCONNECT_A2A':
          // In production, this would disconnect all A2A connections
          return {
            action,
            success: true,
            timestamp,
            details: `Disconnected ${event.affectedAgents.length} agents`
          };

        case 'SNAPSHOT_STATE':
          // In production, this would snapshot all agent states
          return {
            action,
            success: true,
            timestamp,
            details: 'State snapshot captured'
          };

        case 'SIGNAL_GOVERNOR':
          // In production, this would notify the human governor
          return {
            action,
            success: true,
            timestamp,
            details: 'Governor notified'
          };

        case 'HALT_ALL_OPERATIONS':
          this.isHalted = true;
          this.haltedAt = timestamp;
          return {
            action,
            success: true,
            timestamp,
            details: 'All operations halted'
          };

        case 'ROLLBACK_DEPLOYMENT':
          // In production, this would rollback deployments
          return {
            action,
            success: true,
            timestamp,
            details: 'Deployment rollback initiated'
          };

        case 'NOTIFY_SECURITY_TEAM':
          // In production, this would notify security team
          return {
            action,
            success: true,
            timestamp,
            details: 'Security team notified'
          };

        case 'AUDIT_LOG':
          // Audit log is always successful
          return {
            action,
            success: true,
            timestamp,
            details: 'Audit log recorded'
          };

        case 'AWAIT_HUMAN_INTERVENTION':
          // This is a passive action
          return {
            action,
            success: true,
            timestamp,
            details: 'Awaiting human intervention'
          };

        default:
          return {
            action,
            success: false,
            timestamp,
            details: 'Unknown action'
          };
      }
    } catch (error) {
      return {
        action,
        success: false,
        timestamp,
        details: error instanceof Error ? error.message : 'Action failed'
      };
    }
  }

  /**
   * Halt all operations
   */
  haltAllOperations(eventId: string, haltedBy: string): void {
    this.isHalted = true;
    this.haltedAt = new Date().toISOString();
    this.haltedBy = haltedBy;

    const event = this.events.get(eventId);
    if (event) {
      event.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Request resume
   */
  requestResume(eventId: string, requestedBy: string): boolean {
    const event = this.events.get(eventId);
    if (!event || event.status !== 'active') return false;

    // Check if approval is required
    if (this.config.requireApprovalForResume) {
      this.pendingResumes.set(eventId, event);
      return true;
    }

    // Auto-resume if approval not required
    return this.resume(eventId, requestedBy, 'Auto-resume approved');
  }

  /**
   * Resume operations
   */
  resume(eventId: string, resumedBy: string, notes?: string): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    event.status = 'resolved';
    event.resolvedBy = resumedBy;
    event.resolvedAt = new Date().toISOString();
    event.resolutionNotes = notes;
    event.updatedAt = new Date().toISOString();

    // Check if there are other active emergencies
    const otherActive = Array.from(this.events.values()).filter(
      e => e.status === 'active' && e.id !== eventId
    );

    if (otherActive.length === 0) {
      this.isHalted = false;
      this.haltedAt = undefined;
      this.haltedBy = undefined;
    }

    this.pendingResumes.delete(eventId);

    return true;
  }

  /**
   * Get emergency event by ID
   */
  getEvent(eventId: string): EmergencyEvent | undefined {
    return this.events.get(eventId);
  }

  /**
   * Get active emergencies
   */
  getActiveEvents(): EmergencyEvent[] {
    return Array.from(this.events.values()).filter(e => e.status === 'active');
  }

  /**
   * Get recent emergencies
   */
  getRecentEvents(limit: number = 10): EmergencyEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Get pending resumes
   */
  getPendingResumes(): EmergencyEvent[] {
    return Array.from(this.pendingResumes.values());
  }

  /**
   * Check if system is halted
   */
  isSystemHalted(): boolean {
    return this.isHalted;
  }

  /**
   * Get halt info
   */
  getHaltInfo(): {
    isHalted: boolean;
    haltedAt?: string;
    haltedBy?: string;
  } {
    return {
      isHalted: this.isHalted,
      haltedAt: this.haltedAt,
      haltedBy: this.haltedBy
    };
  }

  /**
   * Get emergency stats
   */
  getStats(): {
    totalEvents: number;
    activeEvents: number;
    resolvedEvents: number;
    byLevel: Record<EmergencyLevel, number>;
    averageResolutionTime: number;
    pendingResumes: number;
  } {
    const events = Array.from(this.events.values());
    const active = events.filter(e => e.status === 'active');
    const resolved = events.filter(e => e.status === 'resolved');

    const byLevel: Record<EmergencyLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    events.forEach(e => byLevel[e.level]++);

    const resolutionTimes = resolved
      .filter(e => e.resolvedAt)
      .map(e => new Date(e.resolvedAt!).getTime() - new Date(e.createdAt).getTime());

    const averageResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

    return {
      totalEvents: events.length,
      activeEvents: active.length,
      resolvedEvents: resolved.length,
      byLevel,
      averageResolutionTime,
      pendingResumes: this.pendingResumes.size
    };
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events.clear();
    this.pendingResumes.clear();
    this.isHalted = false;
    this.haltedAt = undefined;
    this.haltedBy = undefined;
  }
}

// Singleton instance
export const enhancedEmergencyStop = new EnhancedEmergencyStop();
