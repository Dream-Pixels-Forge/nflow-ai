/**
 * Graph-Based Workflow Router
 *
 * Deterministic routing in code, not prompts. Agents define nodes and edges;
 * the graph handles routing based on conditions. Inspired by ADK 2.0's
 * graph-based workflow approach.
 *
 * Key insight from vault: "Control flow moves from prompt → code."
 * The LLM only does classification; the graph handles routing.
 */

import type { PipelineContext, PipelineAgent } from "../pipelines/SequentialAgent";

// ── Graph node ──────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  agent: PipelineAgent;
  /** Category for UI display */
  category: "start" | "process" | "decision" | "end" | "human";
}

// ── Graph edge (conditional transition) ─────────────────────────────

export interface GraphEdge {
  from: string;
  to: string;
  /** Condition evaluated against pipeline context state.
   *  Return true to take this edge. If multiple edges from same node,
   *  first matching condition wins. */
  condition: (context: PipelineContext) => boolean;
  /** Human-readable label for UI */
  label: string;
}

// ── Graph workflow config ───────────────────────────────────────────

export interface GraphWorkflowConfig {
  name: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Starting node id */
  startNode: string;
  /** Maximum total node visits (prevents infinite loops) */
  maxVisits: number;
}

// ── Execution trace ─────────────────────────────────────────────────

export interface GraphStep {
  nodeId: string;
  agentName: string;
  input: unknown;
  output: unknown;
  edgesTaken: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface GraphExecution {
  id: string;
  workflowName: string;
  status: "running" | "completed" | "failed" | "max-visits";
  steps: GraphStep[];
  currentNodeId: string;
  visitCounts: Record<string, number>;
  context: PipelineContext;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  error?: string;
}

// ── Graph Workflow Executor ─────────────────────────────────────────

export class GraphWorkflow {
  #config: GraphWorkflowConfig;
  #nodeMap: Map<string, GraphNode>;
  #edgesBySource: Map<string, GraphEdge[]>;

  constructor(config: GraphWorkflowConfig) {
    this.#config = config;
    this.#nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
    this.#edgesBySource = new Map();

    for (const edge of config.edges) {
      const existing = this.#edgesBySource.get(edge.from) ?? [];
      existing.push(edge);
      this.#edgesBySource.set(edge.from, existing);
    }
  }

  async execute(
    initialInput: unknown,
    initialState?: Record<string, unknown>,
  ): Promise<GraphExecution> {
    const execution: GraphExecution = {
      id: `graph-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      workflowName: this.#config.name,
      status: "running",
      steps: [],
      currentNodeId: this.#config.startNode,
      visitCounts: {},
      context: {
        state: new Map(Object.entries(initialState ?? {})),
        input: initialInput,
        metadata: {},
        timestamp: new Date().toISOString(),
      },
      startedAt: new Date().toISOString(),
    };

    let currentInput: unknown = initialInput;

    while (execution.status === "running") {
      const nodeId = execution.currentNodeId;
      const node = this.#nodeMap.get(nodeId);

      if (!node) {
        execution.status = "failed";
        execution.error = `Unknown node: ${nodeId}`;
        break;
      }

      // Check visit count
      const visits = (execution.visitCounts[nodeId] ?? 0) + 1;
      execution.visitCounts[nodeId] = visits;
      if (visits > this.#config.maxVisits) {
        execution.status = "max-visits";
        execution.error = `Max visits (${this.#config.maxVisits}) reached for node "${nodeId}"`;
        break;
      }

      // Terminal node
      if (node.category === "end") {
        const step: GraphStep = {
          nodeId,
          agentName: node.agent.name,
          input: currentInput,
          output: currentInput,
          edgesTaken: [],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        execution.steps.push(step);
        execution.status = "completed";
        break;
      }

      // Execute the agent at this node
      const step: GraphStep = {
        nodeId,
        agentName: node.agent.name,
        input: currentInput,
        output: undefined,
        edgesTaken: [],
        startedAt: new Date().toISOString(),
      };

      try {
        if (node.agent.beforeExecute) {
          await node.agent.beforeExecute(execution.context);
        }

        const output = await node.agent.execute(currentInput, execution.context);

        if (node.agent.outputKey) {
          execution.context.state.set(node.agent.outputKey, output);
        }

        if (node.agent.afterExecute) {
          await node.agent.afterExecute(output, execution.context);
        }

        step.output = output;
        step.completedAt = new Date().toISOString();
        currentInput = output;
      } catch (err) {
        step.error = err instanceof Error ? err.message : String(err);
        step.completedAt = new Date().toISOString();
        execution.steps.push(step);
        execution.status = "failed";
        execution.error = step.error;
        break;
      }

      // Find next node via edges
      const outgoing = this.#edgesBySource.get(nodeId) ?? [];
      const takenEdge = outgoing.find((e) =>
        e.condition(execution.context),
      );

      if (takenEdge) {
        step.edgesTaken.push(takenEdge.label);
        execution.currentNodeId = takenEdge.to;
      } else if (outgoing.length > 0) {
        // No condition matched — follow first edge (default path)
        step.edgesTaken.push(outgoing[0].label);
        execution.currentNodeId = outgoing[0].to;
      } else {
        // No outgoing edges — treat as end
        execution.status = "completed";
      }

      execution.steps.push(step);
    }

    execution.completedAt = new Date().toISOString();
    execution.totalDuration =
      new Date(execution.completedAt).getTime() -
      new Date(execution.startedAt).getTime();

    return execution;
  }

  // ── Static helpers ──────────────────────────────────────────────

  getNode(id: string): GraphNode | undefined {
    return this.#nodeMap.get(id);
  }

  getEdgesFrom(nodeId: string): GraphEdge[] {
    return this.#edgesBySource.get(nodeId) ?? [];
  }
}
