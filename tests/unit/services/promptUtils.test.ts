import { describe, it, expect } from 'vitest';
import { getSystemInstruction } from '../../../services/promptUtils';
import { AgentMode } from '../../../types';

describe('promptUtils - CHAT agent constraints', () => {
  describe('getSystemInstruction for CHAT agent', () => {
    it('should NOT contain instructions TO generate code', () => {
      const instruction = getSystemInstruction(AgentMode.CHAT);
      
      // Should NOT contain instructions TO generate code (but CAN contain prohibitions)
      // Check that it doesn't have the file generation instructions that CODER has
      expect(instruction).not.toContain('When you generate code or configuration files');
      expect(instruction).not.toContain('FILE: path/to/filename.ext');
      expect(instruction).not.toContain('The code block must start on the line');
    });

    it('should contain routing instructions to CODER agent', () => {
      const instruction = getSystemInstruction(AgentMode.CHAT);
      
      // Should contain routing instructions
      expect(instruction).toContain('SWITCH_TO:CODER');
      expect(instruction).toContain('route');
    });

    it('should contain explicit prohibition against code generation', () => {
      const instruction = getSystemInstruction(AgentMode.CHAT);
      
      // Should have explicit rules about what NOT to do
      expect(instruction).toContain('NEVER generate code');
      expect(instruction).toContain('NEVER write implementation');
    });
  });

  describe('getSystemInstruction for CODER agent', () => {
    it('should contain file generation instructions', () => {
      const instruction = getSystemInstruction(AgentMode.CODER);
      
      // CODER should have file generation instructions
      expect(instruction).toContain('FILE:');
      expect(instruction).toContain('code content');
    });
  });
});
