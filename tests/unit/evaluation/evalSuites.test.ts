import { describe, it, expect } from 'vitest';
import { coderSuite, securitySuite, plannerSuite, ALL_SUITES } from '../../../src/evaluation/evalSuites';
import type { EvalSuite } from '../../../src/evaluation/EvaluationFramework';

describe('evalSuites', () => {
  describe('coderSuite', () => {
    it('should be a valid EvalSuite with name and description', () => {
      expect(coderSuite.name).toBe('Coder Quality');
      expect(coderSuite.description).toBeTruthy();
    });

    it('should have 5 test cases', () => {
      expect(coderSuite.cases).toHaveLength(5);
    });

    it('each case should have required fields', () => {
      coderSuite.cases.forEach((c) => {
        expect(c.id).toBeTruthy();
        expect(c.input).toBeTruthy();
        expect(c.expectedPatterns.length).toBeGreaterThan(0);
        expect(c.category).toBeTruthy();
        expect(c.agentType).toBe('coder');
      });
    });
  });

  describe('securitySuite', () => {
    it('should be a valid EvalSuite with name and description', () => {
      expect(securitySuite.name).toBe('Security Audit');
      expect(securitySuite.description).toBeTruthy();
    });

    it('should have 5 test cases', () => {
      expect(securitySuite.cases).toHaveLength(5);
    });

    it('each case should have required fields', () => {
      securitySuite.cases.forEach((c) => {
        expect(c.id).toBeTruthy();
        expect(c.input).toBeTruthy();
        expect(c.expectedPatterns.length).toBeGreaterThan(0);
        expect(c.category).toBeTruthy();
        expect(c.agentType).toBe('secure');
      });
    });
  });

  describe('plannerSuite', () => {
    it('should be a valid EvalSuite with name and description', () => {
      expect(plannerSuite.name).toBe('Planning Quality');
      expect(plannerSuite.description).toBeTruthy();
    });

    it('should have 5 test cases', () => {
      expect(plannerSuite.cases).toHaveLength(5);
    });

    it('each case should have required fields', () => {
      plannerSuite.cases.forEach((c) => {
        expect(c.id).toBeTruthy();
        expect(c.input).toBeTruthy();
        expect(c.expectedPatterns.length).toBeGreaterThan(0);
        expect(c.category).toBeTruthy();
        expect(c.agentType).toBe('plan');
      });
    });
  });

  describe('ALL_SUITES', () => {
    it('should contain all three suites', () => {
      expect(ALL_SUITES).toHaveLength(3);
      expect(ALL_SUITES).toContain(coderSuite);
      expect(ALL_SUITES).toContain(securitySuite);
      expect(ALL_SUITES).toContain(plannerSuite);
    });
  });
});
