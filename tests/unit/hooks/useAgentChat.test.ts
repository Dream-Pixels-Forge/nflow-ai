import { describe, it, expect } from 'vitest';

describe('useAgentChat - CHAT agent code detection', () => {
  // Test the regex patterns used for code detection
  describe('code block detection', () => {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const fileTagRegex = /FILE:\s*\S+/g;

    it('should detect code blocks in CHAT agent response', () => {
      const responseWithCode = `I understand you need a login component.

\`\`\`tsx
export const Login = () => {
  return <form>Login</form>;
};
\`\`\`

Let me route this to our CODER agent.`;

      const hasCode = codeBlockRegex.test(responseWithCode);
      expect(hasCode).toBe(true);
    });

    it('should detect FILE tags in CHAT agent response', () => {
      const responseWithFileTag = `Here's the implementation:

FILE: src/components/Login.tsx
\`\`\`tsx
export const Login = () => <form>Login</form>;
\`\`\``;

      const hasCode = fileTagRegex.test(responseWithFileTag);
      expect(hasCode).toBe(true);
    });

    it('should NOT detect code in normal CHAT response', () => {
      const normalResponse = `I understand you need a login component. Let me route this to our CODER agent for implementation. [[SWITCH_TO:CODER]]`;

      const hasCode = codeBlockRegex.test(normalResponse) || fileTagRegex.test(normalResponse);
      expect(hasCode).toBe(false);
    });
  });

  describe('warning message generation', () => {
    it('should generate appropriate warning when code is detected in CHAT response', () => {
      const warningMsg = {
        id: (Date.now() + 3).toString(),
        role: 'system',
        content: '⚠️ The CHAT agent detected code in its response. Code generation should be handled by the CODER agent. Consider switching to CODER for implementation tasks.',
        timestamp: Date.now(),
        isError: false
      };

      expect(warningMsg.role).toBe('system');
      expect(warningMsg.content).toContain('CHAT agent detected code');
      expect(warningMsg.content).toContain('CODER agent');
      expect(warningMsg.isError).toBe(false);
    });
  });
});
