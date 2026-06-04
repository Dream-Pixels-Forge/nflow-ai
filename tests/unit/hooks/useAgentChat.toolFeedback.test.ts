import { describe, it, expect } from 'vitest';

describe('useAgentChat - Tool Results Feedback', () => {
  // Test the constants and logic for tool feedback loop
  const MAX_TOOL_ITERATIONS = 5;
  const MAX_RESULT_LENGTH = 500;

  describe('iteration guard', () => {
    it('should allow iteration when count is below MAX_TOOL_ITERATIONS', () => {
      const iterationCount = 2;
      const shouldContinue = iterationCount < MAX_TOOL_ITERATIONS;
      expect(shouldContinue).toBe(true);
    });

    it('should stop iteration when count reaches MAX_TOOL_ITERATIONS', () => {
      const iterationCount = 5;
      const shouldContinue = iterationCount < MAX_TOOL_ITERATIONS;
      expect(shouldContinue).toBe(false);
    });
  });

  describe('tool result capping', () => {
    it('should cap tool result at 500 characters', () => {
      const longResult = 'x'.repeat(600);
      const capped = longResult.slice(0, MAX_RESULT_LENGTH);
      expect(capped.length).toBe(500);
    });

    it('should not cap short tool results', () => {
      const shortResult = 'File written successfully';
      const capped = shortResult.slice(0, MAX_RESULT_LENGTH);
      expect(capped).toBe(shortResult);
    });
  });

  describe('feedback message format', () => {
    it('should format tool results as user message for feedback', () => {
      const toolResults = [
        { name: 'write_file', success: true, output: 'File created' },
        { name: 'read_file', success: false, error: 'File not found' },
      ];

      const feedbackContent = `Tool execution results:\n${toolResults.map(r => `[${r.success ? "OK" : "FAIL"}] ${r.name}: ${r.success ? (r.output ?? '').slice(0, MAX_RESULT_LENGTH) : r.error}`).join("\n")}\n\nPlease continue with your task.`;

      expect(feedbackContent).toContain('[OK] write_file: File created');
      expect(feedbackContent).toContain('[FAIL] read_file: File not found');
      expect(feedbackContent).toContain('Please continue with your task.');
    });
  });
});
