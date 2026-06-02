/**
 * Pipeline: Dynamic Instructions
 * 
 * Allows agents to generate instructions based on context state.
 * Based on ADK Dynamic Instructions from Obsidian vault.
 */

import { PipelineContext } from './SequentialAgent';

export type InstructionType = 'static' | 'dynamic' | 'template' | 'conditional';

export interface InstructionDefinition {
  type: InstructionType;
  content: string | ((context: PipelineContext) => string);
  fallback?: string;
}

export interface ConditionalBranch {
  condition: (context: PipelineContext) => boolean;
  instruction: string | ((context: PipelineContext) => string);
}

/**
 * Dynamic Instruction Generator
 */
export class DynamicInstructionGenerator {
  private instructions: Map<string, InstructionDefinition> = new Map();
  private conditionalBranches: Map<string, ConditionalBranch[]> = new Map();

  /**
   * Register a static instruction
   */
  registerStatic(agentId: string, instruction: string): void {
    this.instructions.set(agentId, {
      type: 'static',
      content: instruction
    });
  }

  /**
   * Register a dynamic instruction (function)
   */
  registerDynamic(agentId: string, instructionFn: (context: PipelineContext) => string): void {
    this.instructions.set(agentId, {
      type: 'dynamic',
      content: instructionFn
    });
  }

  /**
   * Register a template instruction with placeholders
   */
  registerTemplate(agentId: string, template: string): void {
    this.instructions.set(agentId, {
      type: 'template',
      content: template
    });
  }

  /**
   * Register conditional instructions
   */
  registerConditional(agentId: string, branches: ConditionalBranch[]): void {
    this.conditionalBranches.set(agentId, branches);
    this.instructions.set(agentId, {
      type: 'conditional',
      content: ''
    });
  }

  /**
   * Generate instruction for an agent
   */
  generate(agentId: string, context: PipelineContext): string {
    // Check for conditional branches first
    const branches = this.conditionalBranches.get(agentId);
    if (branches) {
      for (const branch of branches) {
        if (branch.condition(context)) {
          return typeof branch.instruction === 'function'
            ? branch.instruction(context)
            : branch.instruction;
        }
      }
    }

    // Get instruction definition
    const definition = this.instructions.get(agentId);
    if (!definition) {
      return '';
    }

    switch (definition.type) {
      case 'static':
        return definition.content as string;

      case 'dynamic':
        return (definition.content as (context: PipelineContext) => string)(context);

      case 'template':
        return this.processTemplate(definition.content as string, context);

      case 'conditional':
        // Already handled above
        return definition.fallback || '';

      default:
        return '';
    }
  }

  /**
   * Process template with context variables
   */
  private processTemplate(template: string, context: PipelineContext): string {
    let result = template;

    // Replace {{state.key}} with state values
    const stateRegex = /\{\{state\.(\w+)\}\}/g;
    result = result.replace(stateRegex, (match, key) => {
      return context.state.get(key) || match;
    });

    // Replace {{input}} with input
    result = result.replace(/\{\{input\}\}/g, JSON.stringify(context.input));

    // Replace {{timestamp}} with timestamp
    result = result.replace(/\{\{timestamp\}\}/g, context.timestamp);

    // Replace {{metadata.key}} with metadata values
    const metadataRegex = /\{\{metadata\.(\w+)\}\}/g;
    result = result.replace(metadataRegex, (match, key) => {
      return context.metadata[key] || match;
    });

    return result;
  }

  /**
   * Get all registered instructions
   */
  getInstructions(): Map<string, InstructionDefinition> {
    return new Map(this.instructions);
  }

  /**
   * Clear all instructions
   */
  clear(): void {
    this.instructions.clear();
    this.conditionalBranches.clear();
  }
}

/**
 * Pre-built instruction templates
 */
export const InstructionTemplates = {
  /**
   * Code review instruction
   */
  codeReview: (context: PipelineContext): string => {
    const code = context.state.get('code_to_review') || context.input;
    return `Review the following code for:
1. Correctness and logic errors
2. Edge cases and error handling
3. Performance implications
4. Security vulnerabilities
5. Code style and readability

Code to review:
${code}`;
  },

  /**
   * Style check instruction
   */
  styleCheck: (context: PipelineContext): string => {
    const code = context.state.get('code_to_review') || context.input;
    return `Check the following code for style compliance:
1. PEP 8 compliance (Python)
2. Naming conventions
3. Import organization
4. Docstring presence
5. Line length

Code to check:
${code}`;
  },

  /**
   * Test generation instruction
   */
  testGeneration: (context: PipelineContext): string => {
    const code = context.state.get('code_to_review') || context.input;
    const analysis = context.state.get('structure_analysis_summary') || '';
    return `Generate comprehensive tests for the following code:
${analysis ? `\nCode analysis:\n${analysis}\n` : ''}
Code to test:
${code}

Requirements:
1. Unit tests for all public functions
2. Edge case tests
3. Error handling tests
4. At least 15-20 test cases`;
  },

  /**
   * Code fix instruction
   */
  codeFix: (context: PipelineContext): string => {
    const code = context.state.get('code_to_review') || context.input;
    const issues = context.state.get('issues') || 'No specific issues identified';
    return `Fix the following issues in the code:
${issues}

Original code:
${code}

Requirements:
1. Fix all identified issues
2. Maintain existing functionality
3. Add comments for complex changes
4. Ensure code compiles/runs`;
  },

  /**
   * Synthesis instruction
   */
  synthesis: (context: PipelineContext): string => {
    const results = Array.from(context.state.entries())
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
    return `Synthesize the following analysis results into a comprehensive report:

${results}

Requirements:
1. Summarize key findings
2. Highlight critical issues
3. Provide actionable recommendations
4. Prioritize issues by severity`;
  }
};

/**
 * Create a dynamic instruction provider
 */
export function createInstructionProvider(
  instructions: Record<string, string | ((context: PipelineContext) => string)>
): (agentId: string) => (context: PipelineContext) => string {
  return (agentId: string) => {
    const instruction = instructions[agentId];
    if (!instruction) {
      return () => '';
    }
    return typeof instruction === 'function' ? instruction : () => instruction;
  };
}
