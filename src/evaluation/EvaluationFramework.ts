/**
 * Evaluation Framework for Agent Testing
 *
 * Provides types and a class for running evaluation suites against agent functions,
 * scoring results via pattern matching, and persisting history to IndexedDB.
 */

// ── Types ───────────────────────────────────────────────────────────

export interface EvalCase {
  id: string;
  input: string;
  expectedPatterns: RegExp[];
  category: string;
  agentType: string;
}

export interface EvalResult {
  caseId: string;
  score: number;       // 0–1
  passed: boolean;
  latencyMs: number;
  actualOutput: string;
  notes: string;
}

export interface EvalSuite {
  name: string;
  description: string;
  cases: EvalCase[];
}

export interface EvalSuiteResult {
  suiteName: string;
  results: EvalResult[];
  totalCases: number;
  timestamp: number;
}

export interface AggregatedResults {
  suiteName: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  avgScore: number;
  avgLatencyMs: number;
  timestamp: number;
}

// ── IndexedDB helpers ───────────────────────────────────────────────

const DB_NAME = "nexusflow";
const DB_VERSION = 1;
const STORE_NAME = "evalResults";

interface StoredEvalRow {
  suiteName: string;
  result: EvalSuiteResult;
}

function openEvalDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "suiteName" });
        store.createIndex("suiteName", "suiteName", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error ?? new Error("Failed to open eval IndexedDB"));
    };
  });
}

// ── EvaluationFramework ─────────────────────────────────────────────

export class EvaluationFramework {
  /**
   * Run all cases in a suite against an agent function.
   * Returns results with scores, latency, and pass/fail status.
   */
  async runEvaluation(
    agentFn: (input: string) => Promise<string>,
    suite: EvalSuite,
  ): Promise<EvalSuiteResult> {
    const results: EvalResult[] = [];

    for (const evalCase of suite.cases) {
      const start = performance.now();
      let actualOutput = "";
      try {
        actualOutput = await agentFn(evalCase.input);
      } catch (err) {
        actualOutput = `[ERROR] ${err}`;
      }
      const latencyMs = performance.now() - start;

      // Score: fraction of expected patterns that match
      let matched = 0;
      for (const pattern of evalCase.expectedPatterns) {
        // Reset lastIndex for global regexes
        pattern.lastIndex = 0;
        if (pattern.test(actualOutput)) matched++;
      }
      const score = evalCase.expectedPatterns.length > 0
        ? matched / evalCase.expectedPatterns.length
        : 0;
      const passed = score > 0;

      results.push({
        caseId: evalCase.id,
        score,
        passed,
        latencyMs,
        actualOutput,
        notes: passed
          ? `Matched ${matched}/${evalCase.expectedPatterns.length} patterns`
          : `No patterns matched`,
      });
    }

    return {
      suiteName: suite.name,
      results,
      totalCases: suite.cases.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Compute aggregate statistics from a suite result.
   */
  aggregateResults(suiteResult: EvalSuiteResult): AggregatedResults {
    const { results, suiteName, timestamp } = suiteResult;
    const totalCases = results.length;
    const passedCases = results.filter((r) => r.passed).length;
    const failedCases = totalCases - passedCases;
    const passRate = totalCases > 0 ? passedCases / totalCases : 0;
    const avgScore = totalCases > 0
      ? results.reduce((sum, r) => sum + r.score, 0) / totalCases
      : 0;
    const avgLatencyMs = totalCases > 0
      ? results.reduce((sum, r) => sum + r.latencyMs, 0) / totalCases
      : 0;

    return {
      suiteName,
      totalCases,
      passedCases,
      failedCases,
      passRate,
      avgScore,
      avgLatencyMs,
      timestamp,
    };
  }

  /**
   * Persist evaluation results to IndexedDB.
   */
  async saveResults(suiteName: string, result: EvalSuiteResult): Promise<void> {
    const db = await openEvalDB();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ suiteName, result } satisfies StoredEvalRow);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    return promise;
  }

  /**
   * Retrieve past evaluation results for a suite name.
   */
  async getHistory(suiteName: string): Promise<EvalSuiteResult[]> {
    const db = await openEvalDB();
    const { promise, resolve, reject } = Promise.withResolvers<EvalSuiteResult[]>();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("suiteName");
    const request = index.getAll(suiteName);
    request.onsuccess = () => resolve(request.result.map((row) => row.result));
    request.onerror = () => reject(request.error);
    return promise;
  }
}
