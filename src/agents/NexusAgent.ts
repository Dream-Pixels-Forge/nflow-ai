/**
 * NexusAgent - Base agent class with lifecycle hooks and model binding
 * 
 * Based on ADK's LlmAgent pattern with composable sub-agents.
 */

import { z, ZodSchema } from 'zod';
import { Tool, ToolResult } from './Tool';
import { AgentMode, ChatMode } from '../../types';

export interface AgentContext {
  sessionId: string;
  userId?: string;
  timestamp: number;
  state: Map<string, unknown>;
}

export interface AgentResponse {
  content: string;
  toolCalls?: Array<{
    tool: string;
    params: unknown;
    result: ToolResult;
  }>;
  switchTo?: AgentMode;
  metadata?: Record<string, unknown>;
}

export interface AgentConfig {
  id: AgentMode;
  name: string;
  description: string;
  instruction: string;
  model?: string;
  tools?: Tool[];
  subAgents?: NexusAgent[];
  maxIterations?: number;
  temperature?: number;
}

export interface LifecycleHooks {
  beforeModel?: (ctx: AgentContext, input: string) => Promise<string | null>;
  afterModel?: (ctx: AgentContext, response: string) => Promise<string | null>;
  beforeTool?: (ctx: AgentContext, tool: Tool, params: unknown) => Promise<unknown>;
  afterTool?: (ctx: AgentContext, tool: Tool, result: ToolResult) => Promise<ToolResult>;
  onError?: (ctx: AgentContext, error: Error) => Promise<void>;
}

export class NexusAgent {
  public readonly id: AgentMode;
  public readonly name: string;
  public readonly description: string;
  public readonly instruction: string;
  public readonly model?: string;
  public readonly tools: Tool[];
  public readonly subAgents: NexusAgent[];
  public readonly maxIterations: number;
  public readonly temperature: number;
  
  private hooks: LifecycleHooks = {};
  private state: Map<string, unknown> = new Map();

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.instruction = config.instruction;
    this.model = config.model;
    this.tools = config.tools ?? [];
    this.subAgents = config.subAgents ?? [];
    this.maxIterations = config.maxIterations ?? 10;
    this.temperature = config.temperature ?? 0.7;
  }

  /**
   * Register lifecycle hooks
   */
  useHooks(hooks: LifecycleHooks): this {
    this.hooks = { ...this.hooks, ...hooks };
    return this;
  }

  /**
   * Get full system instruction including tools and sub-agents
   */
  getSystemInstruction(chatMode: ChatMode = 'agent'): string {
    const parts = [
      this.instruction,
      '',
      `Agent: ${this.name} (${this.id})`,
      `Description: ${this.description}`
    ];

    // Add tool descriptions
    if (this.tools.length > 0) {
      parts.push('');
      parts.push('Available Tools:');
      for (const tool of this.tools) {
        parts.push(`- ${tool.name}: ${tool.description}`);
        if (tool.requiresApproval) {
          parts.push(`  (Requires approval for execution)`);
        }
      }
    }

    // Add sub-agent descriptions
    if (this.subAgents.length > 0) {
      parts.push('');
      parts.push('Sub-Agents (use [[SWITCH_TO:AGENT_ID]] to delegate):');
      for (const sub of this.subAgents) {
        parts.push(`- ${sub.id}: ${sub.description}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Get tool definitions for API calls
   */
  getToolDefinitions(): Record<string, unknown>[] {
    return this.tools.map(tool => tool.toJSONSchema());
  }

  /**
   * Find a tool by name
   */
  findTool(name: string): Tool | undefined {
    return this.tools.find(t => t.name === name);
  }

  /**
   * Find a sub-agent by ID
   */
  findSubAgent(id: AgentMode): NexusAgent | undefined {
    return this.subAgents.find(a => a.id === id);
  }

  /**
   * Execute a tool with lifecycle hooks
   */
  async executeTool(
    toolName: string,
    params: unknown,
    ctx: AgentContext
  ): Promise<ToolResult> {
    const tool = this.findTool(toolName);
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool not found: ${toolName}`
      };
    }

    // beforeTool hook
    let processedParams = params;
    if (this.hooks.beforeTool) {
      processedParams = await this.hooks.beforeTool(ctx, tool, params);
    }

    // Execute tool
    const result = await tool.run(processedParams);

    // afterTool hook
    let finalResult = result;
    if (this.hooks.afterTool) {
      finalResult = await this.hooks.afterTool(ctx, tool, result);
    }

    return finalResult;
  }

  /**
   * Process input through agent (can be overridden by subclasses)
   */
  async process(
    input: string,
    ctx: AgentContext,
    modelCallback: (systemInstruction: string, userMessage: string) => Promise<string>
  ): Promise<AgentResponse> {
    // Create context for this run
    const agentCtx: AgentContext = {
      ...ctx,
      state: new Map(this.state)
    };

    // beforeModel hook
    let processedInput = input;
    if (this.hooks.beforeModel) {
      const modified = await this.hooks.beforeModel(agentCtx, input);
      if (modified !== null) {
        processedInput = modified;
      }
    }

    // Get system instruction
    const systemInstruction = this.getSystemInstruction();

    // Call model
    let response: string;
    try {
      response = await modelCallback(systemInstruction, processedInput);
    } catch (err) {
      if (this.hooks.onError) {
        await this.hooks.onError(agentCtx, err as Error);
      }
      throw err;
    }

    // afterModel hook
    let processedResponse = response;
    if (this.hooks.afterModel) {
      const modified = await this.hooks.afterModel(agentCtx, response);
      if (modified !== null) {
        processedResponse = modified;
      }
    }

    // Check for agent switch
    const switchMatch = processedResponse.match(/\[\[SWITCH_TO:(\w+)\]\]/);
    const switchTo = switchMatch ? switchMatch[1] as AgentMode : undefined;

    return {
      content: processedResponse,
      switchTo,
      metadata: {
        agentId: this.id,
        toolCount: this.tools.length,
        subAgentCount: this.subAgents.length
      }
    };
  }

  /**
   * Update agent state
   */
  setState(key: string, value: unknown): void {
    this.state.set(key, value);
  }

  /**
   * Get agent state
   */
  getState(key: string): unknown {
    return this.state.get(key);
  }

  /**
   * Clear agent state
   */
  clearState(): void {
    this.state.clear();
  }
}

/**
 * Helper to create agents with type inference
 */
export function createAgent(config: AgentConfig): NexusAgent {
  return new NexusAgent(config);
}
