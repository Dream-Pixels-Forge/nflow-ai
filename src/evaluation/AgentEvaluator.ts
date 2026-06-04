/**
 * Agent Evaluator - convenient wrapper for running eval suites
 */

import { EvaluationFramework, EvalSuite, EvalSuiteResult } from './EvaluationFramework';
import { ALL_SUITES } from './evalSuites';

export class AgentEvaluator {
  private framework: EvaluationFramework;

  constructor() {
    this.framework = new EvaluationFramework();
  }

  getSuites(): EvalSuite[] {
    return ALL_SUITES;
  }

  getSuiteByName(name: string): EvalSuite | undefined {
    return ALL_SUITES.find(s => s.name === name);
  }

  async runEvaluation(
    suite: EvalSuite,
    mockFn: (input: string) => Promise<string>
  ): Promise<EvalSuiteResult> {
    const result = await this.framework.runEvaluation(mockFn, suite);
    await this.framework.saveResults(suite.name, result);
    return result;
  }

  aggregate(result: EvalSuiteResult) {
    return this.framework.aggregateResults(result);
  }

  async getHistory(suiteName: string): Promise<EvalSuiteResult[]> {
    return this.framework.getHistory(suiteName);
  }
}
