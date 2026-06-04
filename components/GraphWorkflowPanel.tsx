/**
 * GraphWorkflowPanel - DAG-based workflow visualization and execution
 *
 * Shows pre-built workflow templates, graph visualization during execution,
 * and an execution trace table. Wired to PipelineOrchestrator.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AgentMode } from '../types';
import {
  GitBranch,
  Play,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import {
  GraphWorkflow,
  GraphWorkflowConfig,
  GraphNode,
  GraphEdge,
  GraphExecution,
  GraphStep,
} from '../src/pipelines/GraphWorkflow';
import { createAgent, PipelineContext } from '../src/pipelines/SequentialAgent';

interface GraphWorkflowPanelProps {
  activeAgent: AgentMode;
  isProcessing: boolean;
}

// ── Template definitions ────────────────────────────────────────────

type TemplateId = 'code-review' | 'feature-dev' | 'bug-fix';

interface WorkflowTemplate {
  id: TemplateId;
  name: string;
  description: string;
  config: GraphWorkflowConfig;
}

const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Analyze code quality, lint, scan for security issues, and produce a summary.',
    config: {
      name: 'Code Review',
      description: 'Multi-stage code review pipeline',
      startNode: 'analyze',
      maxVisits: 10,
      nodes: [
        {
          id: 'analyze',
          agent: createAgent('analyze', 'Analyze', async (input) => `[Analyzed] ${input}`),
          category: 'start',
        },
        {
          id: 'lint',
          agent: createAgent('lint', 'Lint', async (input) => `[Linted] ${input}`),
          category: 'process',
        },
        {
          id: 'security-scan',
          agent: createAgent('security-scan', 'Security Scan', async (input) => `[Secured] ${input}`),
          category: 'process',
        },
        {
          id: 'summary',
          agent: createAgent('summary', 'Summary', async (input) => `[Summary] ${input}`),
          category: 'end',
        },
      ],
      edges: [
        { from: 'analyze', to: 'lint', condition: () => true, label: 'pass' },
        { from: 'lint', to: 'security-scan', condition: () => true, label: 'pass' },
        { from: 'security-scan', to: 'summary', condition: () => true, label: 'pass' },
      ],
    },
  },
  {
    id: 'feature-dev',
    name: 'Feature Dev',
    description: 'Plan, implement, test, document, and deploy a feature end-to-end.',
    config: {
      name: 'Feature Dev',
      description: 'Full feature development pipeline',
      startNode: 'plan',
      maxVisits: 10,
      nodes: [
        {
          id: 'plan',
          agent: createAgent('plan', 'Plan', async (input) => `[Planned] ${input}`),
          category: 'start',
        },
        {
          id: 'implement',
          agent: createAgent('implement', 'Implement', async (input) => `[Implemented] ${input}`),
          category: 'process',
        },
        {
          id: 'test',
          agent: createAgent('test', 'Test', async (input) => `[Tested] ${input}`),
          category: 'decision',
        },
        {
          id: 'document',
          agent: createAgent('document', 'Document', async (input) => `[Documented] ${input}`),
          category: 'process',
        },
        {
          id: 'deploy',
          agent: createAgent('deploy', 'Deploy', async (input) => `[Deployed] ${input}`),
          category: 'end',
        },
      ],
      edges: [
        { from: 'plan', to: 'implement', condition: () => true, label: 'ready' },
        { from: 'implement', to: 'test', condition: () => true, label: 'submit' },
        { from: 'test', to: 'document', condition: (ctx) => ctx.state.get('test-passed') !== false, label: 'pass' },
        { from: 'test', to: 'implement', condition: () => true, label: 'fail' },
        { from: 'document', to: 'deploy', condition: () => true, label: 'ready' },
      ],
    },
  },
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description: 'Reproduce, diagnose, fix, verify, and report a bug fix.',
    config: {
      name: 'Bug Fix',
      description: 'Bug fix pipeline with verification loop',
      startNode: 'reproduce',
      maxVisits: 10,
      nodes: [
        {
          id: 'reproduce',
          agent: createAgent('reproduce', 'Reproduce', async (input) => `[Reproduced] ${input}`),
          category: 'start',
        },
        {
          id: 'diagnose',
          agent: createAgent('diagnose', 'Diagnose', async (input) => `[Diagnosed] ${input}`),
          category: 'process',
        },
        {
          id: 'fix',
          agent: createAgent('fix', 'Fix', async (input) => `[Fixed] ${input}`),
          category: 'process',
        },
        {
          id: 'verify',
          agent: createAgent('verify', 'Verify', async (input) => `[Verified] ${input}`),
          category: 'decision',
        },
        {
          id: 'report',
          agent: createAgent('report', 'Report', async (input) => `[Reported] ${input}`),
          category: 'end',
        },
      ],
      edges: [
        { from: 'reproduce', to: 'diagnose', condition: () => true, label: 'found' },
        { from: 'diagnose', to: 'fix', condition: () => true, label: 'root-cause' },
        { from: 'fix', to: 'verify', condition: () => true, label: 'patched' },
        { from: 'verify', to: 'report', condition: (ctx) => ctx.state.get('verified') !== false, label: 'pass' },
        { from: 'verify', to: 'fix', condition: () => true, label: 'fail' },
      ],
    },
  },
];

// ── Category color mapping ──────────────────────────────────────────

const CATEGORY_STYLES: Record<GraphNode['category'], { bg: string; border: string; text: string }> = {
  start: { bg: 'bg-green-900/40', border: 'border-green-500/60', text: 'text-green-400' },
  process: { bg: 'bg-cyan-900/40', border: 'border-cyan-500/60', text: 'text-cyan-400' },
  decision: { bg: 'bg-yellow-900/40', border: 'border-yellow-500/60', text: 'text-yellow-400' },
  end: { bg: 'bg-gray-800/60', border: 'border-gray-500/60', text: 'text-gray-400' },
  human: { bg: 'bg-purple-900/40', border: 'border-purple-500/60', text: 'text-purple-400' },
};

// ── Component ───────────────────────────────────────────────────────

export const GraphWorkflowPanel: React.FC<GraphWorkflowPanelProps> = ({
  activeAgent,
  isProcessing,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [execution, setExecution] = useState<GraphExecution | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [liveSteps, setLiveSteps] = useState<GraphStep[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const abortRef = useRef(false);

  const template = TEMPLATES.find((t) => t.id === selectedTemplate) ?? null;

  // Reset when switching templates
  useEffect(() => {
    setExecution(null);
    setIsRunning(false);
    setLiveSteps([]);
    setCurrentNodeId(null);
    abortRef.current = false;
  }, [selectedTemplate]);

  // ── Execute template ────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (!template || isRunning) return;

    abortRef.current = false;
    setIsRunning(true);
    setExecution(null);
    setLiveSteps([]);
    setCurrentNodeId(template.config.startNode);

    const graph = new GraphWorkflow(template.config);

    try {
      const result = await runGraphWithProgress(
        graph,
        template.config,
        (step, nextNodeId) => {
          if (abortRef.current) return;
          setLiveSteps((prev) => [...prev, step]);
          setCurrentNodeId(nextNodeId || null);
        },
      );

      if (!abortRef.current) {
        setExecution(result);
        setCurrentNodeId(null);
      }
    } catch {
      // Error is captured in execution result
    } finally {
      setIsRunning(false);
    }
  }, [template, isRunning]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────

  const formatDuration = (ms?: number): string => {
    if (ms === undefined || ms === null) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const completedNodeIds = new Set(
    (execution?.steps ?? liveSteps).map((s) => s.nodeId),
  );
  // Remove currentNodeId from completed if still running
  if (isRunning && currentNodeId) {
    completedNodeIds.delete(currentNodeId);
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="bg-nexus-900 border border-nexus-border rounded-sm p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-nexus-accent" />
          <span className="text-[10px] font-mono uppercase text-nexus-dim">
            Graph Workflows
          </span>
        </div>
        {isRunning && (
          <span className="text-[9px] font-mono text-cyan-400 animate-pulse">
            RUNNING
          </span>
        )}
      </div>

      {/* Template Cards (shown when no execution) */}
      {!execution && !isRunning && (
        <div className="space-y-2">
          <div className="text-[9px] font-mono text-gray-500 mb-1">TEMPLATES</div>
          {TEMPLATES.map((t) => {
            const isSelected = selectedTemplate === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(isSelected ? null : t.id)}
                className={`w-full text-left p-2.5 rounded-sm border transition-colors ${
                  isSelected
                    ? 'bg-nexus-800 border-nexus-accent/50'
                    : 'bg-nexus-800/40 border-nexus-border hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-white font-bold">
                    {t.name}
                  </span>
                  <span className="text-[9px] font-mono text-gray-500">
                    {t.config.nodes.length} nodes
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 leading-relaxed">
                  {t.description}
                </p>
                {isSelected && (
                  <div className="mt-2 pt-2 border-t border-nexus-border flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRun();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 text-[9px] font-mono
                                 bg-cyan-900/50 border border-cyan-500/50 rounded-sm
                                 text-cyan-400 hover:bg-cyan-800/50 transition-colors"
                    >
                      <Play size={10} />
                      Run
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Graph Visualization (shown during execution or after completion) */}
      {(isRunning || execution) && template && (
        <div className="space-y-3">
          {/* Graph nodes + edges */}
          <div className="bg-nexus-800/40 border border-nexus-border rounded-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono text-gray-500">GRAPH</span>
              {isRunning && (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono
                             bg-red-900/40 border border-red-500/40 rounded-sm
                             text-red-400 hover:bg-red-800/40 transition-colors"
                >
                  <Square size={8} />
                  Stop
                </button>
              )}
            </div>

            {/* Nodes row */}
            <div className="flex items-center gap-1 flex-wrap">
              {template.config.nodes.map((node, idx) => {
                const isCurrent = currentNodeId === node.id && isRunning;
                const isCompleted = completedNodeIds.has(node.id);
                const nodeFailed =
                  execution?.status === 'failed' &&
                  execution.steps.length > 0 &&
                  execution.steps[execution.steps.length - 1].nodeId === node.id &&
                  execution.steps[execution.steps.length - 1].error;
                const styles = CATEGORY_STYLES[node.category];

                return (
                  <React.Fragment key={node.id}>
                    {/* Node badge */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-sm border text-[9px] font-mono transition-all ${styles.bg} ${styles.border} ${styles.text} ${
                        isCurrent
                          ? 'animate-pulse border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                          : ''
                      }`}
                    >
                      {isCompleted && !isCurrent && !nodeFailed && (
                        <CheckCircle size={9} className="text-green-400 shrink-0" />
                      )}
                      {nodeFailed && (
                        <XCircle size={9} className="text-red-400 shrink-0" />
                      )}
                      <span className="truncate max-w-[80px]">{node.agent.name}</span>
                    </div>

                    {/* Edge arrow */}
                    {idx < template.config.nodes.length - 1 && (
                      <ChevronRight size={10} className="text-gray-600 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Execution Trace Table */}
          {(liveSteps.length > 0 || execution) && (
            <div className="bg-nexus-800/40 border border-nexus-border rounded-sm">
              <div className="text-[9px] font-mono text-gray-500 px-3 pt-2 pb-1">
                EXECUTION TRACE
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[9px] font-mono">
                  <thead>
                    <tr className="border-b border-nexus-border text-gray-500">
                      <th className="text-left px-3 py-1 font-normal">#</th>
                      <th className="text-left px-3 py-1 font-normal">Agent</th>
                      <th className="text-left px-3 py-1 font-normal">Duration</th>
                      <th className="text-left px-3 py-1 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(execution?.steps ?? liveSteps).map((step, i) => {
                      const isStepCurrent =
                        isRunning && currentNodeId === step.nodeId && !step.completedAt;
                      const isFailed = !!step.error;
                      const duration = step.completedAt && step.startedAt
                        ? new Date(step.completedAt).getTime() -
                          new Date(step.startedAt).getTime()
                        : undefined;

                      return (
                        <tr
                          key={`${step.nodeId}-${i}`}
                          className={`border-b border-nexus-border/50 ${
                            isStepCurrent ? 'bg-cyan-900/20' : ''
                          }`}
                        >
                          <td className="px-3 py-1 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-1 text-white">{step.agentName}</td>
                          <td className="px-3 py-1 text-gray-400">
                            {formatDuration(duration)}
                          </td>
                          <td className="px-3 py-1">
                            {isFailed ? (
                              <span className="text-red-400 flex items-center gap-1">
                                <XCircle size={8} />
                                Failed
                              </span>
                            ) : isStepCurrent ? (
                              <span className="text-cyan-400 animate-pulse">
                                Running…
                              </span>
                            ) : step.completedAt ? (
                              <span className="text-green-400 flex items-center gap-1">
                                <CheckCircle size={8} />
                                Done
                              </span>
                            ) : (
                              <span className="text-gray-600">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary footer */}
              {execution && (
                <div className="border-t border-nexus-border px-3 py-1.5 flex items-center justify-between text-[9px] font-mono">
                  <span className="text-gray-500">
                    {execution.steps.length} steps
                  </span>
                  <span className="text-gray-500">
                    {formatDuration(execution.totalDuration)}
                  </span>
                  <span
                    className={
                      execution.status === 'completed'
                        ? 'text-green-400'
                        : execution.status === 'failed'
                          ? 'text-red-400'
                          : 'text-yellow-400'
                    }
                  >
                    {execution.status.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Back to templates */}
          {!isRunning && execution && (
            <button
              onClick={() => {
                setExecution(null);
                setSelectedTemplate(null);
              }}
              className="w-full py-1.5 text-[9px] font-mono text-gray-500 hover:text-gray-300
                         border border-nexus-border rounded-sm hover:bg-nexus-800/50 transition-colors"
            >
              ← Back to Templates
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Graph execution with progressive step updates ────────────────────

/**
 * Run a GraphWorkflow and emit progress callbacks as each step completes.
 * Uses the template config directly for graph traversal — no private field access.
 */
async function runGraphWithProgress(
  graph: GraphWorkflow,
  config: GraphWorkflowConfig,
  onStep: (step: GraphStep, nextNodeId: string) => void,
): Promise<GraphExecution> {
  const execution: GraphExecution = {
    id: `graph-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    workflowName: config.name,
    status: 'running',
    steps: [],
    currentNodeId: config.startNode,
    visitCounts: {} as Record<string, number>,
    context: {
      state: new Map(),
      input: 'Graph workflow execution',
      metadata: {},
      timestamp: new Date().toISOString(),
    },
    startedAt: new Date().toISOString(),
  };

  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const edgesBySource = new Map<string, GraphEdge[]>();
  for (const edge of config.edges) {
    const existing = edgesBySource.get(edge.from) ?? [];
    existing.push(edge);
    edgesBySource.set(edge.from, existing);
  }

  let currentInput: unknown = 'Graph workflow execution';
  let nodeId = config.startNode;
  let totalSteps = 0;

  while (execution.status === 'running' && totalSteps < config.maxVisits) {
    const node = nodeMap.get(nodeId);
    if (!node) {
      execution.status = 'failed';
      execution.error = `Unknown node: ${nodeId}`;
      break;
    }

    // Terminal node → just record and finish
    if (node.category === 'end') {
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
      onStep(step, '');
      execution.status = 'completed';
      break;
    }

    // Execute the agent
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
      execution.status = 'failed';
      execution.error = step.error;
      onStep(step, '');
      break;
    }

    // Determine next node via edges
    const outgoing = edgesBySource.get(nodeId) ?? [];
    const takenEdge = outgoing.find((e) => e.condition(execution.context));
    let nextNodeId = '';

    if (takenEdge) {
      step.edgesTaken.push(takenEdge.label);
      nextNodeId = takenEdge.to;
    } else if (outgoing.length > 0) {
      step.edgesTaken.push(outgoing[0].label);
      nextNodeId = outgoing[0].to;
    }

    execution.steps.push(step);
    onStep(step, nextNodeId);
    nodeId = nextNodeId;
    totalSteps++;

    // Small delay so the UI can render between steps
    await new Promise((r) => setTimeout(r, 120));
  }

  execution.completedAt = new Date().toISOString();
  execution.totalDuration =
    new Date(execution.completedAt).getTime() -
    new Date(execution.startedAt).getTime();

  return execution;
}
