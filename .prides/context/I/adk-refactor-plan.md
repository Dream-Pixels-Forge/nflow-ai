# nflow-ai Refactor Plan: ADK TypeScript Agentic Backend

## Current State Analysis

### What nflow-ai Has (Custom Implementations)
nflow-ai currently implements ~15 custom modules that mirror ADK primitives but with **proprietary interfaces and no shared runtime**:

| Custom Module | Lines (est.) | What It Does | ADK Equivalent |
|---|---|---|---|
| `src/agents/NexusAgent.ts` | ~260 | Custom `LlmAgent`-like class with lifecycle hooks | `LlmAgent` |
| `src/agents/Tool.ts` | ~100 | Custom tool wrapper with Zod schemas | `FunctionTool` |
| `src/agents/AgentOrchestrator.ts` | ~200 | Agent composition, routing, handoffs | `AgentTool` + routing rules |
| `src/agents/agents.ts` | ~320 | Pre-built agent definitions (8 agents) | Agent definitions with `LlmAgent` config |
| `src/agentic/AgentOrchestrator.ts` | ~320 | PRIDES phase state machine, heartbeat | Custom (no ADK equivalent — keep as IS) |
| `src/agentic/EmergencyStop.ts` | — | Emergency stop protocol | Custom (no ADK equivalent — keep as IS) |
| `src/agentic/BehavioralDrift.ts` | — | Drift detection | Custom (no ADK equivalent — keep as IS) |
| `src/agentic/PhaseGate.ts` | — | Phase gate enforcement | Custom (no ADK equivalent — keep as IS) |
| `src/agentic/ContextManager.ts` | — | MCP state, conversation memory | ADK `Session` + `State` |
| `src/agentic/LearningManager.ts` | — | Learned patterns persistence | ADK `MemoryService` |
| `src/agentic/CollaborationManager.ts` | — | Agent collaboration signals | ADK `AgentTool` handoffs |
| `src/pipelines/SequentialAgent.ts` | ~310 | Sequential pipeline execution | ADK `SequentialAgent` (workflow) |
| `src/pipelines/LoopAgent.ts` | — | Loop pipeline with exit conditions | ADK `LoopAgent` (workflow) |
| `src/pipelines/GraphWorkflow.ts` | ~230 | Graph-based deterministic routing | ADK `GraphWorkflow` (ADK 2.0) |
| `src/pipelines/HITLManager.ts` | ~220 | Human-in-the-loop pause/resume | ADK `requestInput` / `ctx.resume()` (ADK 2.0) |
| `src/pipelines/StateKeys.ts` | — | State/output key management | ADK `State` prefixes (`session:`, `user:`, `app:`, `temp:`) |
| `src/pipelines/DynamicInstructions.ts` | — | Conditional instruction templates | ADK `instruction` with state templating |
| `src/pipelines/PipelineOrchestrator.ts` | ~300 | Central pipeline coordinator | ADK `Runner` |
| `src/tools/toolDefinitions.ts` | — | Built-in tool schemas (shell, file, web) | ADK `FunctionTool` definitions |
| `src/tools/toolExecutor.ts` | — | Tool execution engine | ADK built-in tool execution loop |
| `src/tools/agenticLoop.ts` | ~200 | ReAct loop with provider abstraction | ADK `Runner.runAsync()` event loop |
| `src/tools/webSocketBridge.ts` | — | Backend bridge for shell/file ops | ADK `CodeExecutionTool` / sandboxed execution |
| `src/tools/tokenCounter.ts` | — | Token budget estimation | ADK built-in token tracking |
| `src/memory/MemoryManager.ts` | — | Persistent memory (types, CRUD) | ADK `MemoryService` / `InMemoryMemoryService` |
| `src/a2a/AgentCard.ts` | — | Agent Card (A2A protocol) | ADK A2A agent card support |
| `src/a2a/TaskManager.ts` | — | A2A task lifecycle | ADK A2A task management |
| `src/a2a/SSEManager.ts` | — | SSE for real-time updates | ADK SSE event streaming |
| `src/mcp/MCPManager.ts` | — | MCP tool/server integration | ADK MCP integration |
| `src/production/PersistentServices.ts` | — | Session/Artifact/MemoryBank services | ADK `SessionService` / `ArtifactService` / `MemoryService` |
| `src/production/Observability.ts` | — | OpenTelemetry tracing | ADK built-in OTel instrumentation |
| `src/production/DeploymentManager.ts` | — | Deployment orchestration | ADK `adk deploy` CLI |
| `src/security/*` | ~15 files | AP2, ModelArmor, CircuitBreaker, OWASP, Auth, SecretManager | ADK callbacks (`before_model`, `after_model`, `before_tool`, `after_tool`) + custom |
| `src/agent-os/AgentOS.ts` | ~500 | 7-layer personal agent OS | Custom (no ADK equivalent — keep as IS) |
| `services/aiService.ts` | ~100 | Multi-provider LLM dispatch | ADK model-agnostic `LlmAgent` |
| `hooks/useAgentChat.ts` | ~740 | React hook managing state + AI calls | Adapt to use `Runner` events |

### Key Problems with Current Architecture

1. **No shared runtime**: Each module reinvents session, state, events independently
2. **Disconnected primitives**: `NexusAgent` ≠ `PipelineAgent` ≠ `agentic/AgentOrchestrator` agents — three separate agent type hierarchies
3. **No standard event bus**: Tool results, pipeline events, and UI updates use ad-hoc patterns
4. **Custom agentic loop**: `runAgenticLoop` reimplements what ADK's `Runner.runAsync()` provides (ReAct loop, tool dispatch, event streaming)
5. **No session/state standardization**: State scattered across `PipelineContext.state: Map<string, any>`, `AgentContext.state: Map<string, unknown>`, `AppSettings`, React component state
6. **Provider coupling**: `aiService.ts` switch/case dispatch → should use ADK model abstraction
7. **No ADK dev tools**: No access to `adk web` (visual debugger), `adk run` (CLI testing)

---

## Target Architecture: ADK TypeScript Backend

### Core ADK Primitives to Adopt

```typescript
// 1. Agents — replace NexusAgent + PipelineAgent
import { LlmAgent, BaseAgent } from '@google/adk';
import { SequentialAgent, ParallelAgent, LoopAgent } from '@google/adk';

// 2. Tools — replace custom Tool class + toolDefinitions
import { FunctionTool } from '@google/adk';

// 3. Runner — replaces PipelineOrchestrator + agenticLoop
import { Runner } from '@google/adk';

// 4. Sessions — replaces ContextManager + PersistentServices.SessionService
import { InMemorySessionService } from '@google/adk';
// Production: DatabaseSessionService or VertexAiSessionService

// 5. State — replaces PipelineContext.state, AgentContext.state, StateKeys
// ADK state prefixes: session:, user:, app:, temp:

// 6. Memory — replaces MemoryManager + LearningManager
import { InMemoryMemoryService } from '@google/adk';

// 7. Artifacts — replaces VirtualFile system partially
import { InMemoryArtifactService } from '@google/adk';

// 8. Callbacks — replaces security/index.ts guards partially
// before_model, after_model, before_tool, after_tool

// 9. Dev Tools — new capability
import '@google/adk-devtools'; // adk web, adk run
```

### What Stays Custom (No ADK Equivalent)

These modules have NO ADK counterpart and remain as custom layers ON TOP of ADK:

- **PRIDES framework**: `agentic/AgentOrchestrator.ts` (phase state machine, heartbeat, transitions)
- **Emergency stop**: `agentic/EmergencyStop.ts`, `security/EnhancedEmergencyStop.ts`
- **Behavioral drift**: `agentic/BehavioralDrift.ts`
- **Phase gates**: `agentic/PhaseGate.ts`
- **AP2 Protocol**: `security/AP2Protocol.ts`
- **Model Armor**: `security/model-armor/ModelArmor.ts`
- **Circuit Breaker**: `security/circuit-breaker/GradientDecayCircuitBreaker.ts`
- **System Prompt Anchor**: `security/circuit-breaker/SystemPromptAnchor.ts`
- **OWASP Compliance**: `security/owasp/OWASPCompliance.ts`
- **Agent Auth**: `security/auth/AgentAuth.ts`
- **Secret Manager**: `security/secret-manager/SecretManager.ts`
- **Verification System**: `security/VerificationSystem.ts`
- **Agent OS**: `agent-os/AgentOS.ts` (7-layer personal agent OS)
- **A2A**: `a2a/AgentCard.ts`, `a2a/TaskManager.ts`, `a2a/SSEManager.ts` (keep until ADK has native A2A TS support)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     React UI Layer (Vite)                       │
│  App.tsx → useAgentChat → AgentWorkflow → GraphWorkflowPanel   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ ADK Runner events (async iterator)
┌──────────────────────────▼──────────────────────────────────────┐
│                 ADK Core (new dependency: @google/adk)           │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ LlmAgent │  │ Sequential │  │ Parallel │  │  LoopAgent  │  │
│  │  (8x)    │  │   Agent    │  │  Agent   │  │  (refactor)  │  │
│  └────┬─────┘  └─────┬──────┘  └────┬─────┘  └──────┬──────┘  │
│       │              │              │               │          │
│  ┌────▼──────────────▼──────────────▼───────────────▼──────┐   │
│  │                    Runner                                │   │
│  │  runAsync() → AsyncEventStream → UI consumes events     │   │
│  └────┬───────────┬──────────────┬──────────────────────┘   │
│       │           │              │                           │
│  ┌────▼──┐  ┌─────▼────┐  ┌────▼─────┐  ┌──────────────┐  │
│  │Session│  │  Memory  │  │ Artifact │  │  FunctionTool │  │
│  │Service│  │  Service │  │  Service │  │  (8+ tools)   │  │
│  └───────┘  └──────────┘  └──────────┘  └──────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Callbacks: before_model / after_model / before_tool  │   │
│  │  → wire to existing security guards                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              Custom Layers (kept as-is, adapted)                 │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────────────────┐  │
│  │ PRIDES  │ │ Security │ │Agent OS│ │ A2A Protocol         │  │
│  │ Phases  │ │ Stack    │ │ 7-Layer│ │ AgentCard/Task/SSE   │  │
│  └─────────┘ └──────────┘ └────────┘ └──────────────────────┘  │
│  ┌──────────────────┐ ┌───────────┐ ┌───────────────────────┐  │
│  │ HITLManager      │ │ Graph     │ │ MCPManager            │  │
│  │ (adapted to ADK) │ │ Workflow  │ │ (adapted to ADK MCP)  │  │
│  └──────────────────┘ └───────────┘ └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Refactor Phases

### Phase 1: Foundation — ADK Integration Layer
**Goal**: Install `@google/adk`, create adapter layer, no breaking changes.

1. **Install ADK**
   - `pnpm add @google/adk`
   - `pnpm add -D @google/adk-devtools`
   - Add `npx adk web` and `npx adk run` scripts to package.json

2. **Create `src/adk/` directory** — adapter layer
   - `src/adk/agents.ts` — Convert 8 agent definitions from `NexusAgent` to `LlmAgent` config objects
   - `src/adk/tools.ts` — Convert `toolDefinitions.ts` schemas to `FunctionTool` instances
   - `src/adk/runner.ts` — Thin wrapper around ADK `Runner` with our session/memory/artifact services
   - `src/adk/sessions.ts` — `InMemorySessionService` init + session factory
   - `src/adk/state.ts` — State prefix utilities (`session:`, `user:`, `app:`, `temp:`)
   - `src/adk/callbacks.ts` — Wire security guards as ADK callbacks (before_model → ModelArmor, before_tool → AP2/OWASP checks)

3. **Type mapping**
   - `AgentMode` enum maps to ADK agent instances
   - `Message` interface → ADK `Content`/`Event` conversion utilities
   - `ToolState` → ADK tool availability driven by agent config
   - `AppSettings` provider config → ADK model selection

4. **Verification**: 
   - Existing code compiles and works unchanged
   - ADK agents can be instantiated with `LlmAgent`
   - `npx adk web` can load an agent and respond to queries

### Phase 2: Agent Migration — Replace NexusAgent with LlmAgent
**Goal**: All 8 agents now defined as ADK `LlmAgent` instances. Old `NexusAgent` deleted.

1. **Rewrite agent definitions** (`src/agents/agents.ts`)
   ```typescript
   // BEFORE (custom NexusAgent)
   export const coderAgent = createAgent({
     id: AgentMode.CODER,
     name: 'Coder',
     description: 'Writes and modifies code',
     instruction: '...',
     tools: [readFileTool, writeFileTool, runTestsTool],
   });

   // AFTER (ADK LlmAgent)
   export const coderAgent = new LlmAgent({
     name: 'coder',
     model: 'gemini-2.5-flash', // or dynamic from settings
     description: 'Writes and modifies code',
     instruction: '...',
     tools: [readFileFunctionTool, writeFileFunctionTool, runTestsFunctionTool],
   });
   ```

2. **Convert tools to FunctionTool** (`src/agents/Tool.ts` → `src/adk/tools.ts`)
   - Each `createTool({...})` → `new FunctionTool({name, description, parameters: z.object({...}), execute: ...})`
   - Shell, file, web tools previously in `toolDefinitions.ts` become `FunctionTool` instances
   - `toolExecutor.ts` execution logic moves into `FunctionTool.execute` callbacks

3. **Delete obsolete files**
   - `src/agents/NexusAgent.ts` (replaced by `LlmAgent`)
   - `src/agents/Tool.ts` (replaced by `FunctionTool`)
   - `src/agents/AgentOrchestrator.ts` (replaced by ADK routing + `AgentTool`)

4. **Update `src/agents/index.ts`** — export ADK-native agents

5. **Verification**:
   - `pnpm dev` loads app with ADK agents
   - Chat with single agent works through ADK Runner
   - Tool calls route through `FunctionTool.execute`

### Phase 3: Pipeline Migration — Replace Custom Pipelines with ADK Workflow Agents
**Goal**: Use ADK `SequentialAgent`, `LoopAgent`, and graph workflows instead of custom implementations.

1. **Sequential pipelines** (`src/pipelines/SequentialAgent.ts`)
   - Replace with ADK `SequentialAgent` which takes sub-agents array
   - `PipelineContext.state` → ADK `Session.state` with prefixes
   - `PipelineAgent.execute` → each step becomes an `LlmAgent` or code `BaseAgent`

2. **Loop pipelines** (`src/pipelines/LoopAgent.ts`)
   - Replace with ADK `LoopAgent` with `maxIterations` and exit condition
   - Exit condition maps directly: `exitCondition` → ADK loop termination function

3. **Graph workflows** (`src/pipelines/GraphWorkflow.ts`)
   - Evaluate if ADK 2.0 graph workflows are available in TS
   - If yes: replace with ADK graph (nodes + conditional edges)
   - If no (TS ADK 2.0 graph not yet available): keep current implementation but adapt state to use ADK `Session.state`

4. **Pipeline orchestrator** (`src/pipelines/PipelineOrchestrator.ts`)
   - Replace with ADK `Runner` — it handles execution, events, state
   - Pipeline config → ADK agent tree (root agent with sub-agents)

5. **State management** (`src/pipelines/StateKeys.ts`)
   - `StateKey` → ADK state keys with `session:`, `user:`, `app:`, `temp:` prefixes
   - `OutputKey` → ADK agent `output_key` config

6. **Dynamic instructions** (`src/pipelines/DynamicInstructions.ts`)
   - ADK `LlmAgent.instruction` supports `{{state:key}}` templating natively
   - Convert conditional branches to graph workflow routing

7. **Delete obsolete files**
   - `src/pipelines/SequentialAgent.ts` → ADK `SequentialAgent`
   - `src/pipelines/LoopAgent.ts` → ADK `LoopAgent`
   - `src/pipelines/PipelineOrchestrator.ts` → ADK `Runner`
   - `src/pipelines/StateKeys.ts` → ADK state prefixes

8. **Verification**:
   - Sequential pipeline: Architect → Coder flow works
   - Loop pipeline: Test iteration with exit condition works
   - Graph workflow: Conditional routing works (if ADK 2.0 graph available)
   - State persists across pipeline steps via `Session.state`

### Phase 4: Session & Memory — Replace Custom Services with ADK Services
**Goal**: Use ADK `SessionService`, `MemoryService`, `ArtifactService` instead of custom implementations.

1. **Session service** (`src/production/PersistentServices.ts` SessionService)
   - Dev: `InMemorySessionService` (already similar to current)
   - Production: `DatabaseSessionService` (replaces custom `db.ts` persistence)
   - Session handles conversation history, state, events natively

2. **Memory service** (`src/memory/MemoryManager.ts` + `src/agentic/LearningManager.ts`)
   - Replace with ADK `InMemoryMemoryService` (dev) / `VertexAiMemoryService` (prod)
   - Memory entries → ADK memory service entries
   - Learning patterns → stored in ADK memory with `user:` prefix

3. **Artifact service** (`src/production/PersistentServices.ts` ArtifactService)
   - Replace with ADK `InMemoryArtifactService` (dev) / GCS-based (prod)
   - Virtual files map to ADK artifacts

4. **Context manager** (`src/agentic/ContextManager.ts`)
   - MCP server state → managed by ADK MCP integration
   - Conversation history → ADK Session handles this natively

5. **Delete/merge obsolete files**
   - `src/memory/MemoryManager.ts` → ADK `MemoryService`
   - `src/agentic/LearningManager.ts` → ADK `MemoryService` (cross-session)
   - `src/agentic/ContextManager.ts` → ADK `Session` + MCP
   - `src/persistence/db.ts` → ADK `DatabaseSessionService`

6. **Verification**:
   - Sessions persist across page reloads (InMemory → refresh loses, but API works)
   - Memory service stores and retrieves cross-session knowledge
   - Artifacts (VirtualFiles) work through ADK artifact service

### Phase 5: Provider Abstraction — Replace aiService.ts with ADK Model Selection
**Goal**: Remove manual provider switch/case; use ADK's model-agnostic agent config.

1. **Remove `services/aiService.ts`** provider dispatch
   - ADK `LlmAgent.model` accepts model strings like `'gemini-2.5-flash'`, `'claude-3-sonnet'`, etc.
   - Model selection happens at agent creation time, not in a service switch

2. **Remove individual provider services** (keep as fallbacks during migration)
   - `services/geminiService.ts` → ADK uses `@google/genai` internally
   - `services/ollamaService.ts` → ADK supports Ollama via model string
   - `services/openRouterService.ts` → ADK supports OpenRouter-compatible endpoints
   - `services/nvidiaService.ts` → ADK supports vLLM-compatible endpoints

3. **Settings integration**
   - `AppSettings.aiProvider` → maps to ADK model string at agent creation
   - `AppSettings.ollamaUrl` → ADK model config base URL

4. **Verification**:
   - Gemini, Ollama, OpenRouter all work through ADK model abstraction
   - No manual provider switch code remains
   - Settings changes (provider, model) take effect on next agent invocation

### Phase 6: Security Integration — Wire Security Stack as ADK Callbacks
**Goal**: Security guards run as ADK callbacks, not standalone interceptors.

1. **Create `src/adk/callbacks.ts`** — maps security modules to ADK callback hooks:
   ```typescript
   // before_model: Input filtering
   - ModelArmor.scan(input) → reject if harmful
   - SystemPromptAnchor.validate(input) → anchor integrity check

   // after_model: Output filtering
   - ModelArmor.scan(output) → sanitize response
   - OWASPCompliance.check(output) → compliance audit

   // before_tool: Usage validation
   - AP2Protocol.checkBalance() → reject if over budget
   - OWASPCompliance.check(toolCall) → validate tool usage
   - CircuitBreaker.check() → reject if circuit open

   // after_tool: Audit logging
   - VerificationSystem.audit(toolResult) → log execution
   - Tracer.recordEvent() → observability
   ```

2. **Emergency stop integration**
   - `EnhancedEmergencyStop` → callback that returns error event to halt runner
   - Circuit breaker open → `before_tool` callback returns false

3. **Keep custom security modules** (they are domain-specific, not general ADK concerns):
   - `AP2Protocol`, `ModelArmor`, `CircuitBreaker`, `OWASPCompliance`
   - `AgentAuth`, `SecretManager`, `VerificationSystem`
   - These get WIRED through callbacks, not replaced

4. **Verification**:
   - Malicious input blocked at `before_model`
   - Tool execution blocked when circuit breaker is open
   - Budget exceeded blocks at `before_tool`
   - All security events logged via observability

### Phase 7: UI Integration — Update useAgentChat Hook + Components
**Goal**: React UI consumes ADK Runner events instead of custom service calls.

1. **Rewrite `hooks/useAgentChat.ts`**
   - Replace `sendMessageToAgent()` with `runner.runAsync()`
   - Event stream replaces manual tool-result re-calls
   - State managed through `Session.state` instead of React state

2. **Update `App.tsx`**
   - Initialize ADK `Runner` and `SessionService` at app level
   - Pass runner to `useAgentChat` instead of service functions
   - Agent switching → create new runner with different root agent

3. **Update components**
   - `AgentWorkflow.tsx` → visualize ADK agent tree instead of custom orchestrator
   - `GraphWorkflowPanel.tsx` → visualize ADK graph nodes/edges
   - `HITLDialog.tsx` → consume ADK `requestInput` events (ADK 2.0)
   - `ToolsPanel.tsx` → display `FunctionTool` instances
   - `SystemMonitor.tsx` → consume ADK observability events

4. **Dev tools integration**
   - Add `adk web` script for standalone agent debugging
   - Add `adk run` script for CLI agent testing

5. **Verification**:
   - Full chat flow works through ADK Runner
   - Tool calls display in UI with results
   - Agent switching works
   - HITL approval flow works
   - Pipeline execution visible in UI

### Phase 8: Cleanup & Polish
**Goal**: Remove dead code, update tests, update docs.

1. **Delete all obsolete files** (accumulated across phases)
   - `src/agents/NexusAgent.ts`
   - `src/agents/Tool.ts`
   - `src/agents/AgentOrchestrator.ts`
   - `src/pipelines/SequentialAgent.ts`
   - `src/pipelines/LoopAgent.ts`
   - `src/pipelines/PipelineOrchestrator.ts`
   - `src/pipelines/StateKeys.ts`
   - `src/pipelines/DynamicInstructions.ts`
   - `src/tools/agenticLoop.ts`
   - `src/tools/toolDefinitions.ts`
   - `src/tools/toolExecutor.ts`
   - `src/tools/tokenCounter.ts`
   - `src/tools/types.ts`
   - `services/geminiService.ts`
   - `services/ollamaService.ts`
   - `services/openRouterService.ts`
   - `services/nvidiaService.ts`
   - `services/aiService.ts`
   - `services/aiStreamService.ts`

2. **Update tests**
   - Rewrite agent tests to use ADK `LlmAgent` config
   - Rewrite tool tests to use `FunctionTool`
   - Rewrite pipeline tests to use ADK workflow agents
   - Add integration test: `Runner.runAsync()` → event stream → final response

3. **Update package.json**
   - Add `@google/adk` dependency
   - Add `@google/adk-devtools` dev dependency
   - Add scripts: `adk:web`, `adk:run`, `adk:deploy`
   - Remove unused dependencies (check what ADK makes obsolete)

4. **Update `.prides/` context**
   - New implementation plan reflecting ADK migration
   - Update audit results

5. **Verification**:
   - `pnpm build` succeeds
   - `pnpm test` passes
   - `pnpm dev` loads working app
   - `npx adk web` loads agent for debugging
   - No dead imports or unused files

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| ADK TS API instability (v0.x) | Pin exact version; adapter layer isolates breaking changes |
| Graph workflows not yet in TS ADK | Keep custom `GraphWorkflow.ts` under ADK state management; migrate when available |
| HITL not yet in TS ADK | Keep `HITLManager.ts`; adapt when ADK 2.0 dynamic workflows land in TS |
| Provider-specific features lost | ADK model-agnostic covers Gemini + Ollama + OpenRouter; check niche features |
| Large React hook rewrite | Phase 7 is the riskiest phase — do it last when backend is stable |
| Test coverage gaps during migration | Each phase has verification criteria; keep old tests passing until replacement verified |

## Estimated Effort

| Phase | Estimated Time | Dependency |
|-------|---------------|------------|
| Phase 1: Foundation | 2-3 hours | None |
| Phase 2: Agent Migration | 3-4 hours | Phase 1 |
| Phase 3: Pipeline Migration | 4-5 hours | Phase 2 |
| Phase 4: Session & Memory | 2-3 hours | Phase 2 |
| Phase 5: Provider Abstraction | 2-3 hours | Phase 2 |
| Phase 6: Security Integration | 3-4 hours | Phase 2 |
| Phase 7: UI Integration | 5-6 hours | Phases 2-6 |
| Phase 8: Cleanup | 2-3 hours | Phase 7 |
| **Total** | **23-31 hours** | |

## Execution Order

```
Phase 1 (Foundation)
    │
    ▼
Phase 2 (Agent Migration)
    │
    ├── Phase 3 (Pipelines) ─── can run in parallel with ─── Phase 4 (Sessions)
    │                                                            │
    ├── Phase 5 (Providers) ─── can run in parallel with ──── Phase 6 (Security)
    │                                                            │
    └──────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
                    Phase 7 (UI Integration)
                           │
                           ▼
                    Phase 8 (Cleanup)
```

## Obsidian Vault Sources Used

- `wiki/concepts/agent-development-kit.md` — ADK overview, design principles
- `wiki/concepts/agent-development-kit-2.md` — ADK 2.0 features
- `wiki/sources/adk-2.0-game-changer.md` — ADK 2.0 graph workflows, collaborative agents, HITL
- `raw/AI-Agents/ADK/Build your first Typescript agent with Google ADK.md` — TS ADK API walkthrough
- `wiki/sources/build-your-first-typescript-agent-with-google-adk.md` — Summary
- ADK docs at adk.dev — Quickstart, agents, workflows API reference

## Key Decisions

1. **Adapter layer first** — `src/adk/` wraps all ADK interactions so the rest of the codebase migrates gradually
2. **Keep PRIDES + security custom** — These have no ADK equivalent and ARE the differentiating value
3. **HITL stays custom for now** — ADK 2.0 dynamic workflows with `requestInput` not yet confirmed in TS; keep `HITLManager.ts`
4. **Graph workflow stays custom if needed** — ADK 2.0 graph API availability in TS TBD; current `GraphWorkflow.ts` adapted to ADK state
5. **A2A stays custom for now** — ADK TS A2A support not yet confirmed; keep `a2a/` module
6. **Provider services removed last** — Once ADK model abstraction proves stable across all 4 providers
