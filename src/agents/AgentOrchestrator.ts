/**
 * AgentOrchestrator - Agent composition, routing, and lifecycle management
 * 
 * Based on ADK's multi-agent workflow patterns with nested agent support.
 */

import { NexusAgent, AgentContext, AgentResponse } from './NexusAgent';
import { AgentMode, ChatMode } from '../../types';
import { Tool } from './Tool';

export interface RoutingRule {
  pattern: RegExp;
  targetAgent: AgentMode;
  priority?: number;
}

export interface OrchestratorConfig {
  rootAgent: NexusAgent;
  routingRules?: RoutingRule[];
  maxHandoffs?: number;
  enableLearning?: boolean;
}

export interface HandoffRecord {
  from: AgentMode;
  to: AgentMode;
  reason: string;
  timestamp: number;
  input: string;
}

export class AgentOrchestrator {
  private agents: Map<AgentMode, NexusAgent> = new Map();
  private rootAgent: NexusAgent;
  private routingRules: RoutingRule[];
  private maxHandoffs: number;
  private handoffHistory: HandoffRecord[] = [];
  private activeAgentId: AgentMode;

  constructor(config: OrchestratorConfig) {
    this.rootAgent = config.rootAgent;
    this.routingRules = config.routingRules ?? [];
    this.maxHandoffs = config.maxHandoffs ?? 5;
    this.activeAgentId = config.rootAgent.id;

    // Register all agents (root + sub-agents)
    this.registerAgent(config.rootAgent);
    for (const sub of config.rootAgent.subAgents) {
      this.registerAgent(sub);
    }
  }

  /**
   * Register an agent
   */
  registerAgent(agent: NexusAgent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Get agent by ID
   */
  getAgent(id: AgentMode): NexusAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): NexusAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get active agent
   */
  getActiveAgent(): NexusAgent {
    return this.agents.get(this.activeAgentId) ?? this.rootAgent;
  }

  /**
   * Route input to appropriate agent based on rules
   */
  routeInput(input: string): AgentMode {
    // Check routing rules
    for (const rule of this.routingRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) {
      if (rule.pattern.test(input)) {
        return rule.targetAgent;
      }
    }

    // Check for explicit switch
    const switchMatch = input.match(/\[\[SWITCH_TO:(\w+)\]\]/);
    if (switchMatch) {
      return switchMatch[1] as AgentMode;
    }

    // Default to active agent
    return this.activeAgentId;
  }

  /**
   * Process input through the orchestrator
   */
  async process(
    input: string,
    ctx: AgentContext,
    modelCallback: (agentId: AgentMode, systemInstruction: string, userMessage: string) => Promise<string>
  ): Promise<AgentResponse> {
    let currentAgentId = this.routeInput(input);
    let currentInput = input;
    let handoffCount = 0;

    // Process through agent chain
    while (handoffCount < this.maxHandoffs) {
      const agent = this.agents.get(currentAgentId);
      if (!agent) {
        return {
          content: `Error: Agent ${currentAgentId} not found`,
          metadata: { error: true }
        };
      }

      // Update active agent
      this.activeAgentId = currentAgentId;

      // Process through agent
      const response = await agent.process(
        currentInput,
        ctx,
        (systemInstruction, userMessage) => modelCallback(currentAgentId, systemInstruction, userMessage)
      );

      // Check for handoff
      if (response.switchTo && this.agents.has(response.switchTo)) {
        // Record handoff
        this.handoffHistory.push({
          from: currentAgentId,
          to: response.switchTo,
          reason: 'Agent switch requested',
          timestamp: Date.now(),
          input: currentInput.slice(0, 100)
        });

        currentAgentId = response.switchTo;
        currentInput = response.content;
        handoffCount++;
        continue;
      }

      // No handoff, return response
      return response;
    }

    // Max handoffs reached
    return {
      content: `Warning: Maximum handoffs (${this.maxHandoffs}) reached. Stopping at ${currentAgentId}.`,
      metadata: { maxHandoffsReached: true }
    };
  }

  /**
   * Get handoff history
   */
  getHandoffHistory(): HandoffRecord[] {
    return [...this.handoffHistory];
  }

  /**
   * Clear handoff history
   */
  clearHandoffHistory(): void {
    this.handoffHistory = [];
  }

  /**
   * Add routing rule
   */
  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.push(rule);
  }

  /**
   * Get orchestrator stats
   */
  getStats(): {
    totalAgents: number;
    activeAgent: AgentMode;
    totalHandoffs: number;
    recentHandoffs: HandoffRecord[];
  } {
    return {
      totalAgents: this.agents.size,
      activeAgent: this.activeAgentId,
      totalHandoffs: this.handoffHistory.length,
      recentHandoffs: this.handoffHistory.slice(-5)
    };
  }
}

/**
 * Helper to create an orchestrator
 */
export function createOrchestrator(config: OrchestratorConfig): AgentOrchestrator {
  return new AgentOrchestrator(config);
}
