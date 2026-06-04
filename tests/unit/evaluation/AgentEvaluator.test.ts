import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentEvaluator } from '../../../src/evaluation/AgentEvaluator';
import { coderSuite } from '../../../src/evaluation/evalSuites';

// Mock IndexedDB (same pattern as EvaluationFramework.test.ts)
function createMockIDB() {
  const stores: Record<string, Map<string, any>> = {};
  function getStore(name: string) {
    if (!stores[name]) stores[name] = new Map();
    return stores[name];
  }
  const mockDB: any = {};
  Object.defineProperty(mockDB, 'objectStoreNames', {
    get: () => ({ contains: (name: string) => stores[name] !== undefined }),
  });
  mockDB.createObjectStore = () => mockIndex;
  mockDB.transaction = (name: string, _mode: string) => {
    const store = getStore(name);
    return {
      objectStore: () => ({
        put: (value: any) => {
          const req: any = { onsuccess: null, onerror: null, result: value };
          store.set(value.suiteName || value.key || 'unknown', value);
          queueMicrotask(() => req.onsuccess?.({ target: { result: value } }));
          return req;
        },
        getAll: () => {
          const result = Array.from(store.values());
          const req: any = { onsuccess: null, onerror: null, result };
          queueMicrotask(() => req.onsuccess?.({ target: { result } }));
          return req;
        },
        index: () => ({
          getAll: (key: string) => {
            const filtered = Array.from(store.values()).filter((v: any) => v.suiteName === key);
            const req: any = { onsuccess: null, onerror: null, result: filtered };
            queueMicrotask(() => req.onsuccess?.({ target: { result: filtered } }));
            return req;
          },
        }),
      }),
    };
  };
  mockDB.close = () => {};
  const mockIndex: any = { createIndex: () => mockIndex };
  return {
    open: (_name: string, _version: number) => {
      const req: any = {};
      let _handler: ((e: any) => void) | null = null;
      Object.defineProperty(req, 'onsuccess', {
        get: () => _handler,
        set: (fn: any) => { _handler = fn; fn?.({ target: { result: mockDB } }); },
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

describe('AgentEvaluator', () => {
  it('should return all suites from getSuites()', () => {
    const evaluator = new AgentEvaluator();
    const suites = evaluator.getSuites();
    expect(suites).toHaveLength(3);
    expect(suites.map(s => s.name)).toContain('Coder Quality');
    expect(suites.map(s => s.name)).toContain('Security Audit');
    expect(suites.map(s => s.name)).toContain('Planning Quality');
  });

  it('should find a suite by name via getSuiteByName()', () => {
    const evaluator = new AgentEvaluator();
    const suite = evaluator.getSuiteByName('Coder Quality');
    expect(suite).toBeDefined();
    expect(suite?.name).toBe('Coder Quality');
  });

  it('should return undefined for unknown suite name', () => {
    const evaluator = new AgentEvaluator();
    const suite = evaluator.getSuiteByName('Nonexistent Suite');
    expect(suite).toBeUndefined();
  });

  it('should run evaluation with a mock function and return results', async () => {
    const evaluator = new AgentEvaluator();
    const mockFn = async (input: string) => `I can help with: ${input} - try { JSON.parse(input) } catch {}`;
    const result = await evaluator.runEvaluation('coder', coderSuite, mockFn);
    expect(result.suiteName).toBe('Coder Quality');
    expect(result.results).toHaveLength(5);
    expect(result.totalCases).toBe(5);
  });

  it('should get history for a suite', async () => {
    const evaluator = new AgentEvaluator();
    const history = await evaluator.getHistory('Coder Quality');
    expect(Array.isArray(history)).toBe(true);
  });
});
