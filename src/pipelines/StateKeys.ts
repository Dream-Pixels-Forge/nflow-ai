/**
 * Pipeline: State Keys & Output Keys
 * 
 * Constants and utilities for reliable data passing between agents.
 * Based on ADK State Keys from Obsidian vault.
 */

import { PipelineContext } from './SequentialAgent';

/**
 * StateKey - Type-safe constant for state keys
 */
export class StateKey<T = any> {
  public readonly key: string;
  public readonly description: string;
  public readonly defaultValue?: T;

  constructor(key: string, description: string = '', defaultValue?: T) {
    this.key = key;
    this.description = description;
    this.defaultValue = defaultValue;
  }

  /**
   * Get value from context
   */
  get(context: PipelineContext): T | undefined {
    return context.state.get(this.key) ?? this.defaultValue;
  }

  /**
   * Set value in context
   */
  set(context: PipelineContext, value: T): void {
    context.state.set(this.key, value);
  }

  /**
   * Check if key exists in context
   */
  has(context: PipelineContext): boolean {
    return context.state.has(this.key);
  }

  /**
   * Delete key from context
   */
  delete(context: PipelineContext): boolean {
    return context.state.delete(this.key);
  }

  /**
   * Get or set default
   */
  getOrSet(context: PipelineContext, defaultValue: T): T {
    if (!this.has(context)) {
      this.set(context, defaultValue);
    }
    return this.get(context)!;
  }
}

/**
 * OutputKey - Configuration for agent output storage
 */
export interface OutputKeyConfig {
  key: string;
  transform?: (output: any) => any;
  validate?: (output: any) => boolean;
  merge?: boolean; // Merge with existing state instead of overwriting
}

/**
 * OutputKey - Manages agent output storage
 */
export class OutputKey {
  public readonly key: string;
  public readonly transform?: (output: any) => any;
  public readonly validate?: (output: any) => boolean;
  public readonly merge: boolean;

  constructor(config: OutputKeyConfig) {
    this.key = config.key;
    this.transform = config.transform;
    this.validate = config.validate;
    this.merge = config.merge || false;
  }

  /**
   * Store output in context
   */
  store(output: any, context: PipelineContext): boolean {
    // Validate if validator exists
    if (this.validate && !this.validate(output)) {
      console.error(`[OutputKey] Validation failed for key: ${this.key}`);
      return false;
    }

    // Transform if transform exists
    const finalOutput = this.transform ? this.transform(output) : output;

    // Store in context
    if (this.merge && context.state.has(this.key)) {
      const existing = context.state.get(this.key);
      if (typeof existing === 'object' && typeof finalOutput === 'object') {
        context.state.set(this.key, { ...existing, ...finalOutput });
      } else {
        context.state.set(this.key, finalOutput);
      }
    } else {
      context.state.set(this.key, finalOutput);
    }

    return true;
  }

  /**
   * Get value from context
   */
  retrieve(context: PipelineContext): any {
    return context.state.get(this.key);
  }
}

/**
 * Pre-defined State Keys for common data
 */
export const CommonStateKeys = {
  // Code-related
  CODE_TO_REVIEW: new StateKey<string>('code_to_review', 'Code to be reviewed'),
  CODE_ANALYSIS: new StateKey<any>('code_analysis', 'Code analysis results'),
  STYLE_CHECK_RESULT: new StateKey<any>('style_check_result', 'Style check results'),
  TEST_RESULTS: new StateKey<any>('test_results', 'Test execution results'),
  ISSUES: new StateKey<any[]>('issues', 'Identified issues'),
  
  // Pipeline state
  CURRENT_STEP: new StateKey<number>('current_step', 'Current pipeline step'),
  TOTAL_STEPS: new StateKey<number>('total_steps', 'Total pipeline steps'),
  PIPELINE_NAME: new StateKey<string>('pipeline_name', 'Name of current pipeline'),
  
  // Agent state
  CURRENT_AGENT: new StateKey<string>('current_agent', 'Current agent ID'),
  AGENT_OUTPUT: new StateKey<any>('agent_output', 'Latest agent output'),
  
  // User context
  USER_INPUT: new StateKey<string>('user_input', 'Original user input'),
  USER_PREFERENCES: new StateKey<Record<string, any>>('user_preferences', 'User preferences'),
  
  // Results
  FINAL_OUTPUT: new StateKey<any>('final_output', 'Final pipeline output'),
  ERRORS: new StateKey<string[]>('errors', 'Accumulated errors'),
  
  // Metadata
  EXECUTION_ID: new StateKey<string>('execution_id', 'Pipeline execution ID'),
  START_TIME: new StateKey<string>('start_time', 'Pipeline start time'),
  METADATA: new StateKey<Record<string, any>>('metadata', 'Pipeline metadata')
};

/**
 * Pre-defined Output Keys for common outputs
 */
export const CommonOutputKeys = {
  /**
   * Store code analysis
   */
  CODE_ANALYSIS: new OutputKey({
    key: 'code_analysis',
    validate: (output) => output && typeof output === 'object' && 'structure' in output,
    transform: (output) => ({
      ...output,
      timestamp: new Date().toISOString()
    })
  }),

  /**
   * Store style check results
   */
  STYLE_CHECK: new OutputKey({
    key: 'style_check_result',
    validate: (output) => output && typeof output === 'object',
    transform: (output) => ({
      ...output,
      passed: output.violations?.length === 0,
      timestamp: new Date().toISOString()
    })
  }),

  /**
   * Store test results
   */
  TEST_RESULTS: new OutputKey({
    key: 'test_results',
    validate: (output) => output && typeof output === 'object',
    transform: (output) => ({
      ...output,
      passed: output.failures === 0,
      timestamp: new Date().toISOString()
    })
  }),

  /**
   * Store issues (merge with existing)
   */
  ISSUES: new OutputKey({
    key: 'issues',
    merge: true,
    transform: (output) => {
      if (Array.isArray(output)) {
        return { issues: output };
      }
      return { issues: [output] };
    }
  }),

  /**
   * Store final synthesis
   */
  SYNTHESIS: new OutputKey({
    key: 'final_output',
    validate: (output) => output && typeof output === 'string',
    transform: (output) => ({
      content: output,
      timestamp: new Date().toISOString(),
      wordCount: output.split(/\s+/).length
    })
  })
};

/**
 * State Manager - Utility for managing pipeline state
 */
export class StateManager {
  private context: PipelineContext;

  constructor(context: PipelineContext) {
    this.context = context;
  }

  /**
   * Get value by state key
   */
  get<T>(key: StateKey<T>): T | undefined {
    return key.get(this.context);
  }

  /**
   * Set value by state key
   */
  set<T>(key: StateKey<T>, value: T): void {
    key.set(this.context, value);
  }

  /**
   * Get all state as object
   */
  toObject(): Record<string, any> {
    const obj: Record<string, any> = {};
    this.context.state.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Load state from object
   */
  fromObject(obj: Record<string, any>): void {
    Object.entries(obj).forEach(([key, value]) => {
      this.context.state.set(key, value);
    });
  }

  /**
   * Clear state
   */
  clear(): void {
    this.context.state.clear();
  }

  /**
   * Get state size
   */
  size(): number {
    return this.context.state.size;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.context.state.has(key);
  }

  /**
   * Delete key
   */
  delete(key: string): boolean {
    return this.context.state.delete(key);
  }
}

/**
 * Create a state manager from context
 */
export function createStateManager(context: PipelineContext): StateManager {
  return new StateManager(context);
}
