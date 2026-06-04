# GraphWorkflow UI Integration

## Task
Wire the existing `GraphWorkflow` engine (`src/pipelines/GraphWorkflow.ts`) to a new UI panel so users can define, visualize, and execute DAG-based workflows.

## Existing Code
- `src/pipelines/GraphWorkflow.ts`: Full graph executor with `GraphNode`, `GraphEdge`, `GraphWorkflowConfig`, `GraphExecution`, `GraphStep`. Supports conditional routing, visit limits, execution tracing.
- `src/pipelines/PipelineOrchestrator.ts`: Manages sequential/loop pipelines, execution history, stats.
- `components/AgentWorkflow.tsx`: Current workflow visualization (status matrix, flow path, handoffs).
- `components/RightPanel.tsx`: Tab container with Telemetry, Tools, GitHub, Flow, Adaptive tabs.

## Requirements
1. Create `components/GraphWorkflowPanel.tsx` — new tab/panel for graph workflows
2. Allow users to select from pre-built workflow templates (code-review, feature-dev, bug-fix)
3. Show graph visualization (nodes + edges + current position) during execution
4. Display execution trace (steps, durations, outputs)
5. Wire to `PipelineOrchestrator` for execution
6. Add a "Graph" tab to RightPanel (between Flow and Adaptive)
7. Use existing dark theme (nexus-900, nexus-accent, nexus-border)

## Pre-built Templates
- **Code Review**: Analyze → Lint → Security Scan → Summary
- **Feature Dev**: Plan → Implement → Test → Document → Deploy
- **Bug Fix**: Reproduce → Diagnose → Fix → Verify → Report

## UI Style
- Match existing tab styling in RightPanel
- Nodes: colored badges with agent name and category icon
- Edges: animated lines with condition labels
- Current node: pulsing cyan glow
- Completed nodes: green checkmark
- Failed nodes: red X
