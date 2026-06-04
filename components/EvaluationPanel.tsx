import React, { useState } from 'react';
import { TestTube, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { AgentEvaluator } from '../src/evaluation/AgentEvaluator';
import { EvalSuiteResult } from '../src/evaluation/EvaluationFramework';
import { ALL_SUITES } from '../src/evaluation/evalSuites';

const evaluator = new AgentEvaluator();

// Mock agent function that generates realistic-ish responses
async function mockAgentResponse(input: string): Promise<string> {
  // Simulate processing delay
  await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

  const lower = input.toLowerCase();

  if (lower.includes('json') || lower.includes('parse')) {
    return `function safeParse(str) {
  try {
    return { data: JSON.parse(str), error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}`;
  }

  if (lower.includes('react') || lower.includes('component')) {
    return `interface Props {
  title: string;
  count: number;
}

export const Counter: React.FC<Props> = ({ title, count }) => {
  return <div><h1>{title}</h1><span>{count}</span></div>;
};`;
  }

  if (lower.includes('email') || lower.includes('valid')) {
    return `function validateEmail(email) {
  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return regex.test(email);
}`;
  }

  if (lower.includes('debounce')) {
    return `function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}`;
  }

  if (lower.includes('fetch') || lower.includes('error')) {
    return `async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e) {
    console.error('Fetch failed:', e);
    return null;
  }
}`;
  }

  if (lower.includes('password') || lower.includes('hash')) {
    return `Use bcrypt with salt rounds of 12. Never store plaintext passwords. Hash with bcrypt.hash(password, 12) and verify with bcrypt.compare.`;
  }

  if (lower.includes('url') || lower.includes('fetcher')) {
    return `Allowlist approved domains. Validate URL scheme is http/https. Reject internal IPs to prevent SSRF. Sanitize the input before use.`;
  }

  if (lower.includes('html') || lower.includes('input')) {
    return `Sanitize user input before rendering. Use textContent instead of innerHTML. Encode special characters to prevent XSS attacks.`;
  }

  if (lower.includes('api key') || lower.includes('store')) {
    return `Never hardcode API keys. Use environment variables or a secret vault. Store in .env file with proper gitignore configuration.`;
  }

  if (lower.includes('jwt') || lower.includes('token')) {
    return `Verify JWT tokens using the correct algorithm. Check expiration with exp claim. Validate audience and issuer fields.`;
  }

  if (lower.includes('plan') || lower.includes('architecture')) {
    return `## Steps
1. Identify dependencies and prerequisites
2. Break into phases with milestones
3. Define acceptance criteria for each step
4. Plan rollback strategy and testing`;
  }

  if (lower.includes('migration') || lower.includes('database')) {
    return `## Migration Plan
- Create backup before starting
- Write reversible migration scripts
- Test rollback procedure
- Verify data integrity after migration`;
  }

  if (lower.includes('ci/cd') || lower.includes('pipeline')) {
    return `## CI/CD Pipeline
Build → Test → Lint → Security Scan → Deploy to staging → Verify → Deploy to production`;
  }

  return `Here is my response to: ${input}. This addresses the core requirements.`;
}

interface ScoreBadgeProps {
  score: number;
}

function ScoreBadge({ score }: ScoreBadgeProps) {
  const color = score >= 0.7 ? 'text-green-400 bg-green-900/30 border-green-500/30'
    : score >= 0.4 ? 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30'
    : 'text-red-400 bg-red-900/30 border-red-500/30';
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${color}`}>
      {(score * 100).toFixed(0)}%
    </span>
  );
}

export const EvaluationPanel: React.FC = () => {
  const [selectedSuite, setSelectedSuite] = useState(ALL_SUITES[0]?.name || '');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvalSuiteResult | null>(null);
  const [history, setHistory] = useState<EvalSuiteResult[]>([]);

  const handleRun = async () => {
    const suite = evaluator.getSuiteByName(selectedSuite);
    if (!suite) return;

    setRunning(true);
    try {
      const res = await evaluator.runEvaluation(suite, mockAgentResponse);
      setResult(res);
      const hist = await evaluator.getHistory(suite.name);
      setHistory(hist);
    } catch (e) {
      console.error('Eval failed:', e);
    }
    setRunning(false);
  };

  const aggregated = result ? evaluator.aggregate(result) : null;

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-mono text-nexus-accent">
        <TestTube size={14} />
        <span className="font-bold">AGENT EVALUATOR</span>
      </div>

      {/* Suite Selector */}
      <div>
        <label className="text-[10px] text-gray-500 font-mono uppercase mb-1 block">Eval Suite</label>
        <div className="flex gap-2">
          <select
            value={selectedSuite}
            onChange={(e) => setSelectedSuite(e.target.value)}
            className="flex-1 bg-nexus-800 border border-nexus-border rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-nexus-accent"
          >
            {ALL_SUITES.map(s => (
              <option key={s.name} value={s.name}>{s.name} ({s.cases.length} cases)</option>
            ))}
          </select>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-nexus-accent/20 border border-nexus-accent/50 text-nexus-accent rounded text-[10px] font-mono font-bold hover:bg-nexus-accent/30 transition-colors disabled:opacity-50"
          >
            {running ? (
              <><Clock size={10} className="animate-spin" /> Running...</>
            ) : (
              <><Play size={10} /> Run</>
            )}
          </button>
        </div>
      </div>

      {/* Summary */}
      {aggregated && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-nexus-800 border border-nexus-border rounded p-2 text-center">
            <div className={`text-lg font-mono font-bold ${aggregated.passRate >= 0.7 ? 'text-green-400' : aggregated.passRate >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
              {(aggregated.passRate * 100).toFixed(0)}%
            </div>
            <div className="text-[9px] text-gray-500 font-mono">PASS RATE</div>
          </div>
          <div className="bg-nexus-800 border border-nexus-border rounded p-2 text-center">
            <div className="text-lg font-mono font-bold text-nexus-accent">
              {(aggregated.avgScore * 100).toFixed(0)}%
            </div>
            <div className="text-[9px] text-gray-500 font-mono">AVG SCORE</div>
          </div>
          <div className="bg-nexus-800 border border-nexus-border rounded p-2 text-center">
            <div className="text-lg font-mono font-bold text-white">
              {aggregated.passedCases}/{aggregated.totalCases}
            </div>
            <div className="text-[9px] text-gray-500 font-mono">PASSED</div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {result && (
        <div>
          <div className="text-[10px] text-gray-500 font-mono uppercase mb-2">Results</div>
          <div className="space-y-1">
            {result.results.map(r => (
              <div key={r.caseId} className="flex items-center gap-2 px-2 py-1.5 bg-nexus-800 border border-nexus-border rounded text-[10px]">
                {r.passed ? (
                  <CheckCircle size={10} className="text-green-400 flex-shrink-0" />
                ) : (
                  <XCircle size={10} className="text-red-400 flex-shrink-0" />
                )}
                <span className="text-gray-300 font-mono flex-1 truncate">{r.caseId}</span>
                <ScoreBadge score={r.score} />
                <span className="text-gray-600 font-mono w-12 text-right">{r.latencyMs.toFixed(0)}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-mono uppercase mb-2">History</div>
          <div className="space-y-1">
            {history.slice(-5).reverse().map((h, i) => {
              const agg = evaluator.aggregate(h);
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1 bg-nexus-800/50 border border-nexus-border/50 rounded text-[10px]">
                  <span className="text-gray-400 font-mono flex-1">{new Date(h.timestamp).toLocaleString()}</span>
                  <ScoreBadge score={agg.passRate} />
                  <span className="text-gray-600 font-mono">{agg.passedCases}/{agg.totalCases}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !running && (
        <div className="text-center py-8 text-gray-600 text-[10px] font-mono">
          Select a suite and click Run to evaluate
        </div>
      )}
    </div>
  );
};
