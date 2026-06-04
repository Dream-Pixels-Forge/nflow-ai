# Evaluation Framework for Agent Testing

## Task
Build a lightweight evaluation framework that tests agent quality, measures response accuracy, and tracks performance over time.

## Requirements
1. Create `src/evaluation/EvaluationFramework.ts`:
   - `EvalCase`: test input + expected output + category
   - `EvalResult`: actual output + score + latency + token usage
   - `EvalSuite`: collection of eval cases with metadata
   - `EvaluationFramework`: runs evals, aggregates scores, tracks history

2. Create `src/evaluation/evalSuites.ts`:
   - Pre-built eval suites for each agent type
   - Code quality: syntax correctness, best practices, error handling
   - Security: no hardcoded secrets, input validation, SSRF protection
   - Planning: task decomposition quality, dependency identification

3. Create `src/evaluation/AgentEvaluator.ts`:
   - Takes an agent + eval suite
   - Runs each case through the agent
   - Scores results (automated heuristics, not LLM-judge)
   - Produces report with pass/fail, latency, token usage

4. Create `components/EvaluationPanel.tsx`:
   - UI to select agent + eval suite
   - Run evaluation button
   - Results table (case, score, latency, status)
   - Historical trend chart (simple SVG line chart)
   - Add "Eval" tab to RightPanel

## Scoring Heuristics
- **Coder**: compile check (mock), line count ratio, has error handling
- **Security**: no eval/new Function, no document.cookie access, validates inputs
- **Planner**: has dependencies, has acceptance criteria, has steps
- **通用**: response length > 0, no "I don't know", includes actionable content

## UI Style
- Match existing dark theme
- Green/red/yellow score badges
- Simple bar chart for historical scores
