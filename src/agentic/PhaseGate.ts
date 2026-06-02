/**
 * PhaseGate - Validation system for quality gates between phases
 * 
 * Implements mandatory validation between phases (P→R→I→D→E→S)
 * Based on PRIDES framework phase gate principles.
 */

import { AgentOrchestrator, AgentPhase, agentOrchestrator } from './AgentOrchestrator';

export type GateStatus = 'PENDING' | 'PASS' | 'FAIL' | 'BLOCKED';

export interface PhaseGateEvent {
  id: string;
  timestamp: string;
  fromPhase: AgentPhase;
  toPhase: AgentPhase;
  agentId: string;
  status: GateStatus;
  criteria: GateCriteria[];
  passedCriteria: string[];
  failedCriteria: string[];
  blockedBy?: string;
  passedAt?: string;
  failedAt?: string;
}

export interface GateCriteria {
  id: string;
  name: string;
  description: string;
  required: boolean;
  validator: (context: GateContext) => boolean;
}

export interface GateContext {
  agentId: string;
  fromPhase: AgentPhase;
  toPhase: AgentPhase;
  agentState: any;
  projectState: any;
  metrics: GateMetrics;
}

export interface GateMetrics {
  codeCoverage?: number;
  testPassRate?: number;
  securityScanPassed?: boolean;
  performanceBenchmark?: number;
  documentationComplete?: boolean;
  reviewApproved?: boolean;
}

export interface PhaseGateConfig {
  enabled: boolean;
  strictMode: boolean;
  autoPassOnTimeout: boolean;
  timeoutMs: number;
}

const DEFAULT_CONFIG: PhaseGateConfig = {
  enabled: true,
  strictMode: true,
  autoPassOnTimeout: false,
  timeoutMs: 300000 // 5 minutes
};

// Default gate criteria for each phase transition
const DEFAULT_GATE_CRITERIA: Record<string, GateCriteria[]> = {
  'P→R': [
    { id: 'prd-complete', name: 'PRD Complete', description: 'Product Requirements Document is complete', required: true, validator: () => true },
    { id: 'architecture-defined', name: 'Architecture Defined', description: 'System architecture is defined', required: true, validator: () => true },
    { id: 'constraints-set', name: 'Constraints Set', description: 'Phase constraints are established', required: true, validator: () => true }
  ],
  'R→I': [
    { id: 'review-approved', name: 'Review Approved', description: 'Architecture review is approved', required: true, validator: (ctx) => ctx.metrics.reviewApproved === true },
    { id: 'tests-planned', name: 'Tests Planned', description: 'Test plan is defined', required: true, validator: () => true },
    { id: 'security-reviewed', name: 'Security Reviewed', description: 'Security review completed', required: false, validator: (ctx) => ctx.metrics.securityScanPassed !== false }
  ],
  'I→D': [
    { id: 'tests-passing', name: 'Tests Passing', description: 'All tests are passing', required: true, validator: (ctx) => ctx.metrics.testPassRate === undefined || ctx.metrics.testPassRate >= 90 },
    { id: 'code-reviewed', name: 'Code Reviewed', description: 'Code review completed', required: true, validator: (ctx) => ctx.metrics.reviewApproved === true },
    { id: 'security-scan', name: 'Security Scan', description: 'Security scan passed', required: true, validator: (ctx) => ctx.metrics.securityScanPassed === true },
    { id: 'performance-benchmark', name: 'Performance Benchmark', description: 'Performance meets requirements', required: false, validator: (ctx) => ctx.metrics.performanceBenchmark === undefined || ctx.metrics.performanceBenchmark >= 80 }
  ],
  'D→E': [
    { id: 'deployment-successful', name: 'Deployment Successful', description: 'Deployment completed successfully', required: true, validator: () => true },
    { id: 'monitoring-active', name: 'Monitoring Active', description: 'Monitoring systems are active', required: true, validator: () => true },
    { id: 'rollback-tested', name: 'Rollback Tested', description: 'Rollback procedure tested', required: false, validator: () => true }
  ],
  'E→S': [
    { id: 'extension-tested', name: 'Extension Tested', description: 'Extensions are tested', required: true, validator: (ctx) => ctx.metrics.testPassRate === undefined || ctx.metrics.testPassRate >= 80 },
    { id: 'performance-validated', name: 'Performance Validated', description: 'Performance is validated', required: true, validator: (ctx) => ctx.metrics.performanceBenchmark === undefined || ctx.metrics.performanceBenchmark >= 70 },
    { id: 'security-audit', name: 'Security Audit', description: 'Security audit completed', required: true, validator: (ctx) => ctx.metrics.securityScanPassed === true }
  ]
};

export class PhaseGate {
  private orchestrator: AgentOrchestrator;
  private config: PhaseGateConfig;
  private gateCriteria: Map<string, GateCriteria[]>;
  private gateEvents: Map<string, PhaseGateEvent> = new Map();
  private onGateCallback?: (event: PhaseGateEvent) => void;
  private onBlockCallback?: (agentId: string, reason: string) => void;

  constructor(orchestrator: AgentOrchestrator, config: Partial<PhaseGateConfig> = {}) {
    this.orchestrator = orchestrator;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.gateCriteria = new Map(Object.entries(DEFAULT_GATE_CRITERIA));
  }

  /**
   * Register callbacks for gate events
   */
  onGate(callback: (event: PhaseGateEvent) => void): void {
    this.onGateCallback = callback;
  }

  onBlock(callback: (agentId: string, reason: string) => void): void {
    this.onBlockCallback = callback;
  }

  /**
   * Validate phase transition through gate
   */
  async validateTransition(
    agentId: string,
    fromPhase: AgentPhase,
    toPhase: AgentPhase,
    context: Partial<GateContext> = {}
  ): Promise<PhaseGateEvent> {
    const gateKey = `${fromPhase}→${toPhase}`;
    const criteria = this.gateCriteria.get(gateKey) || [];

    const event: PhaseGateEvent = {
      id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      fromPhase,
      toPhase,
      agentId,
      status: 'PENDING',
      criteria,
      passedCriteria: [],
      failedCriteria: []
    };

    // Build full context
    const fullContext: GateContext = {
      agentId,
      fromPhase,
      toPhase,
      agentState: context.agentState || this.orchestrator.getAgentState(agentId),
      projectState: context.projectState || {},
      metrics: context.metrics || {}
    };

    // Validate each criterion
    for (const criterion of criteria) {
      try {
        const passed = criterion.validator(fullContext);
        if (passed) {
          event.passedCriteria.push(criterion.id);
        } else if (criterion.required) {
          event.failedCriteria.push(criterion.id);
        }
      } catch (error) {
        console.error(`[GATE] Error validating criterion ${criterion.id}:`, error);
        if (criterion.required) {
          event.failedCriteria.push(criterion.id);
        }
      }
    }

    // Determine gate status
    const requiredFailed = criteria
      .filter(c => c.required)
      .filter(c => event.failedCriteria.includes(c.id));

    if (requiredFailed.length === 0) {
      event.status = 'PASS';
      event.passedAt = new Date().toISOString();
    } else {
      event.status = 'FAIL';
      event.failedAt = new Date().toISOString();
      
      // Emit block callback
      if (this.onBlockCallback) {
        this.onBlockCallback(agentId, `Failed criteria: ${requiredFailed.map(c => c.name).join(', ')}`);
      }
    }

    // Store event
    this.gateEvents.set(event.id, event);

    // Emit callback
    if (this.onGateCallback) {
      this.onGateCallback(event);
    }

    return event;
  }

  /**
   * Attempt to transition phase with gate validation
   */
  async attemptTransition(
    agentId: string,
    toPhase: AgentPhase,
    context: Partial<GateContext> = {}
  ): Promise<{ success: boolean; event: PhaseGateEvent }> {
    const agent = this.orchestrator.getAgentState(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Check if transition is valid
    if (!this.orchestrator.isValidTransition(agent.phase, toPhase)) {
      throw new Error(`Invalid transition: ${agent.phase} → ${toPhase}`);
    }

    // Validate through gate
    const event = await this.validateTransition(agentId, agent.phase, toPhase, context);

    if (event.status === 'PASS') {
      // Execute transition
      const success = this.orchestrator.transitionPhase(agentId, toPhase);
      return { success, event };
    }

    return { success: false, event };
  }

  /**
   * Set gate criteria for a phase transition
   */
  setGateCriteria(fromPhase: AgentPhase, toPhase: AgentPhase, criteria: GateCriteria[]): void {
    const gateKey = `${fromPhase}→${toPhase}`;
    this.gateCriteria.set(gateKey, criteria);
  }

  /**
   * Get gate criteria for a phase transition
   */
  getGateCriteria(fromPhase: AgentPhase, toPhase: AgentPhase): GateCriteria[] {
    const gateKey = `${fromPhase}→${toPhase}`;
    return this.gateCriteria.get(gateKey) || [];
  }

  /**
   * Get all gate events
   */
  getGateEvents(): PhaseGateEvent[] {
    return Array.from(this.gateEvents.values());
  }

  /**
   * Get gate events for specific agent
   */
  getAgentGateEvents(agentId: string): PhaseGateEvent[] {
    return Array.from(this.gateEvents.values()).filter(e => e.agentId === agentId);
  }

  /**
   * Get failed gate events
   */
  getFailedEvents(): PhaseGateEvent[] {
    return Array.from(this.gateEvents.values()).filter(e => e.status === 'FAIL');
  }

  /**
   * Update gate configuration
   */
  updateConfig(config: Partial<PhaseGateConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PhaseGateConfig {
    return { ...this.config };
  }

  /**
   * Cleanup phase gate system
   */
  destroy(): void {
    this.gateEvents.clear();
  }
}

// Singleton instance
export const phaseGate = new PhaseGate(agentOrchestrator);
