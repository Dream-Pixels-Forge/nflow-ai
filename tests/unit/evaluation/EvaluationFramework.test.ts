import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EvaluationFramework,
  type EvalCase,
  type EvalResult,
  type EvalSuite,
  type EvalSuiteResult,
} from '../../../src/evaluation/EvaluationFramework';

// Mock IndexedDB for jsdom environment
// Uses a simple synchronous approach: open() returns a request that fires
// onsuccess synchronously via a property setter proxy.
function createMockIDB() {
  const stores: Record<string, Map<string, any>> = {};

  function getStore(name: string) {
    if (!stores[name]) stores[name] = new Map();
    return stores[name];
  }

  const mockDB: any = {};
  // Forward objectStoreNames.contains calls to check stores
  Object.defineProperty(mockDB, 'objectStoreNames', {
    get: () => ({
      contains: (name: string) => stores[name] !== undefined,
    }),
  });

  mockDB.createObjectStore = (name: string) => {
    getStore(name); // ensure store exists
    return mockIndex;
  };

  mockDB.transaction = (name: string, _mode: string) => {
    const store = getStore(name);
    return {
      objectStore: (_n: string) => ({
        put: (value: any) => {
          const req: any = { onsuccess: null, onerror: null, result: null };
          const key = value.suiteName || value.key || 'unknown';
          store.set(key, value);
          req.result = value;
          queueMicrotask(() => req.onsuccess?.({ target: { result: value } }));
          return req;
        },
        get: (key: string) => {
          const req: any = { onsuccess: null, onerror: null, result: store.get(key) };
          queueMicrotask(() => req.onsuccess?.({ target: { result: req.result } }));
          return req;
        },
        getAll: () => {
          const result = Array.from(store.values());
          const req: any = { onsuccess: null, onerror: null, result };
          queueMicrotask(() => req.onsuccess?.({ target: { result } }));
          return req;
        },
        index: (_name: string) => ({
          getAll: (key: string) => {
            const filtered = Array.from(store.values()).filter((v: any) => v.suiteName === key);
            const req: any = { onsuccess: null, onerror: null, result: filtered };
            queueMicrotask(() => req.onsuccess?.({ target: { result: filtered } }));
            return req;
          },
        }),
        delete: (key: string) => {
          const req: any = { onsuccess: null, onerror: null };
          store.delete(key);
          queueMicrotask(() => req.onsuccess?.({ target: {} }));
          return req;
        },
        clear: () => {
          const req: any = { onsuccess: null, onerror: null };
          store.clear();
          queueMicrotask(() => req.onsuccess?.({ target: {} }));
          return req;
        },
      }),
      oncomplete: null,
      onerror: null,
      complete: () => {},
    };
  };

  mockDB.close = () => {};

  const mockIndex: any = {
    createIndex: () => mockIndex,
  };

  return {
    open: (_name: string, _version: number) => {
      const req: any = {};
      // Use a proxy/setter so that when openEvalDB sets req.onsuccess = ..., the callback fires immediately
      let _handler: ((e: any) => void) | null = null;
      Object.defineProperty(req, 'onsuccess', {
        get: () => _handler,
        set: (fn: any) => {
          _handler = fn;
          // Fire synchronously — the Promise constructor is still executing so resolve() will work
          fn?.({ target: { result: mockDB } });
        },
        configurable: true,
      });
      req.onerror = null;
      req.onupgradeneeded = null;
      req.result = mockDB;
      return req;
    },
  };
}

beforeEach(() => {
  // @ts-expect-error - mocking global indexedDB
  globalThis.indexedDB = createMockIDB();
});

describe('EvaluationFramework', () => {
  describe('EvalCase type', () => {
    it('should have required fields', () => {
      const evalCase: EvalCase = {
        id: 'test-1',
        input: 'Write a function to add two numbers',
        expectedPatterns: [/function\s+add/],
        category: 'code-generation',
        agentType: 'CODER',
      };
      expect(evalCase.id).toBe('test-1');
      expect(evalCase.input).toBeTruthy();
      expect(evalCase.expectedPatterns).toHaveLength(1);
      expect(evalCase.category).toBeTruthy();
      expect(evalCase.agentType).toBeTruthy();
    });
  });

  describe('EvalResult type', () => {
    it('should have required fields', () => {
      const result: EvalResult = {
        caseId: 'test-1',
        score: 0.85,
        passed: true,
        latencyMs: 120,
        actualOutput: 'function add(a, b) { return a + b; }',
        notes: 'Good implementation',
      };
      expect(result.caseId).toBe('test-1');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(typeof result.passed).toBe('boolean');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.actualOutput).toBe('string');
    });
  });

  describe('EvalSuite type', () => {
    it('should have required fields', () => {
      const suite: EvalSuite = {
        name: 'coder-suite',
        description: 'Tests code generation quality',
        cases: [],
      };
      expect(suite.name).toBeTruthy();
      expect(suite.description).toBeTruthy();
      expect(Array.isArray(suite.cases)).toBe(true);
    });
  });

  describe('EvaluationFramework.runEvaluation', () => {
    it('should run all cases in a suite and return results', async () => {
      const framework = new EvaluationFramework();
      const mockAgentFn = async (input: string) => `response to: ${input}`;
      const suite: EvalSuite = {
        name: 'test-suite',
        description: 'Test suite',
        cases: [
          {
            id: 'case-1',
            input: 'hello',
            expectedPatterns: [/hello/],
            category: 'general',
            agentType: 'CHAT',
          },
          {
            id: 'case-2',
            input: 'world',
            expectedPatterns: [/world/],
            category: 'general',
            agentType: 'CHAT',
          },
        ],
      };

      const result = await framework.runEvaluation(mockAgentFn, suite);

      expect(result.suiteName).toBe('test-suite');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].caseId).toBe('case-1');
      expect(result.results[1].caseId).toBe('case-2');
      expect(result.totalCases).toBe(2);
    });

    it('should score results based on pattern matching', async () => {
      const framework = new EvaluationFramework();
      const mockAgentFn = async (input: string) => `I can help with: ${input}`;
      const suite: EvalSuite = {
        name: 'pattern-test',
        description: 'Pattern matching test',
        cases: [
          {
            id: 'match-1',
            input: 'test',
            expectedPatterns: [/can help/],
            category: 'general',
            agentType: 'CHAT',
          },
        ],
      };

      const result = await framework.runEvaluation(mockAgentFn, suite);

      expect(result.results[0].passed).toBe(true);
      expect(result.results[0].score).toBeGreaterThan(0);
    });

    it('should fail cases when patterns do not match', async () => {
      const framework = new EvaluationFramework();
      const mockAgentFn = async (_input: string) => 'wrong response';
      const suite: EvalSuite = {
        name: 'fail-test',
        description: 'Should fail',
        cases: [
          {
            id: 'fail-1',
            input: 'test',
            expectedPatterns: [/expected_pattern_not_found/],
            category: 'general',
            agentType: 'CHAT',
          },
        ],
      };

      const result = await framework.runEvaluation(mockAgentFn, suite);

      expect(result.results[0].passed).toBe(false);
      expect(result.results[0].score).toBe(0);
    });

    it('should measure latency for each case', async () => {
      const framework = new EvaluationFramework();
      const mockAgentFn = async (_input: string) => {
        // Simulate some work
        await new Promise((r) => setTimeout(r, 10));
        return 'done';
      };
      const suite: EvalSuite = {
        name: 'latency-test',
        description: 'Latency test',
        cases: [
          {
            id: 'lat-1',
            input: 'test',
            expectedPatterns: [/done/],
            category: 'general',
            agentType: 'CHAT',
          },
        ],
      };

      const result = await framework.runEvaluation(mockAgentFn, suite);

      expect(result.results[0].latencyMs).toBeGreaterThanOrEqual(5);
    });
  });

  describe('EvaluationFramework.aggregateResults', () => {
    it('should compute pass rate, avg latency, and avg score', async () => {
      const framework = new EvaluationFramework();
      const mockAgentFn = async (input: string) => `response: ${input}`;
      const suite: EvalSuite = {
        name: 'agg-test',
        description: 'Aggregation test',
        cases: [
          {
            id: 'a',
            input: 'hello',
            expectedPatterns: [/hello/],
            category: 'general',
            agentType: 'CHAT',
          },
          {
            id: 'b',
            input: 'world',
            expectedPatterns: [/world/],
            category: 'general',
            agentType: 'CHAT',
          },
          {
            id: 'c',
            input: 'test',
            expectedPatterns: [/not_match/],
            category: 'general',
            agentType: 'CHAT',
          },
        ],
      };

      const result = await framework.runEvaluation(mockAgentFn, suite);
      const aggregated = framework.aggregateResults(result);

      expect(aggregated.passRate).toBeCloseTo(2 / 3, 2);
      expect(aggregated.avgScore).toBeGreaterThan(0);
      expect(aggregated.avgLatencyMs).toBeGreaterThanOrEqual(0);
      expect(aggregated.totalCases).toBe(3);
      expect(aggregated.passedCases).toBe(2);
      expect(aggregated.failedCases).toBe(1);
    });
  });

  describe('EvaluationFramework.saveResults and getHistory', () => {
    it('should persist and retrieve results by suite name', async () => {
      const framework = new EvaluationFramework();
      const mockAgentFn = async (input: string) => `response: ${input}`;
      const suite: EvalSuite = {
        name: 'persist-test',
        description: 'Persistence test',
        cases: [
          {
            id: 'p1',
            input: 'test',
            expectedPatterns: [/test/],
            category: 'general',
            agentType: 'CHAT',
          },
        ],
      };

      const result = await framework.runEvaluation(mockAgentFn, suite);
      await framework.saveResults('persist-test', result);

      const history = await framework.getHistory('persist-test');
      expect(history).toHaveLength(1);
      expect(history[0].suiteName).toBe('persist-test');
    });

    it('should return empty array for unknown suite name', async () => {
      const framework = new EvaluationFramework();
      const history = await framework.getHistory('non-existent-suite');
      expect(history).toHaveLength(0);
    });
  });
});
