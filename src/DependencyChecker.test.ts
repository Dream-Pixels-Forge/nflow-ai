import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkDependencies, checkNodeVersion } from './utils/DependencyChecker';
import { Dependency } from './models/Dependency';

// Mock process.version for Node.js version testing
vi.mock('process', () => ({
  version: 'v18.17.0',
}));

describe('DependencyChecker', () => {
  describe('checkNodeVersion', () => {
    it('should return true for Node.js version 18+', () => {
      // Using a spy to check the version parsing
      expect(checkNodeVersion()).toBe(true);
    });
  });

  describe('checkDependencies', () => {
    it('should return a valid DependencyCheckResult structure', async () => {
      const result = await checkDependencies();
      
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('missingDependencies');
      expect(result).toHaveProperty('incompatibleDependencies');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('actionSteps');
      
      expect(result.missingDependencies).toBeInstanceOf(Array);
      expect(result.incompatibleDependencies).toBeInstanceOf(Array);
      expect(result.actionSteps).toBeInstanceOf(Array);
    });

    it('should have success as a boolean', async () => {
      const result = await checkDependencies();
      expect(typeof result.success).toBe('boolean');
    });

    it('should have message as a string', async () => {
      const result = await checkDependencies();
      expect(typeof result.message).toBe('string');
    });
  });
});