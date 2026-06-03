/**
 * Tool - Type-safe tool definitions with Zod schema validation
 * 
 * Based on ADK's FunctionTool pattern with schema validation.
 */

import { z, ZodSchema } from 'zod';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolConfig<T extends ZodSchema = ZodSchema> {
  name: string;
  description: string;
  parameters: T;
  execute: (params: z.infer<T>) => Promise<ToolResult> | ToolResult;
  requiresApproval?: boolean;
  category?: 'file' | 'git' | 'code' | 'search' | 'system';
}

export class Tool<T extends ZodSchema = ZodSchema> {
  public readonly name: string;
  public readonly description: string;
  public readonly parameters: T;
  public readonly execute: (params: z.infer<T>) => Promise<ToolResult> | ToolResult;
  public readonly requiresApproval: boolean;
  public readonly category: string;

  constructor(config: ToolConfig<T>) {
    this.name = config.name;
    this.description = config.description;
    this.parameters = config.parameters;
    this.execute = config.execute;
    this.requiresApproval = config.requiresApproval ?? false;
    this.category = config.category ?? 'system';
  }

  /**
   * Validate parameters against schema
   */
  validate(params: unknown): { valid: boolean; data?: z.infer<T>; error?: string } {
    try {
      const result = this.parameters.safeParse(params);
      if (result.success) {
        return { valid: true, data: result.data };
      }
      return { valid: false, error: result.error.message };
    } catch (err) {
      return { valid: false, error: String(err) };
    }
  }

  /**
   * Execute tool with validation
   */
  async run(params: unknown): Promise<ToolResult> {
    const validation = this.validate(params);
    if (!validation.valid) {
      return {
        success: false,
        output: '',
        error: `Validation error: ${validation.error}`
      };
    }

    try {
      return await this.execute(validation.data!);
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `Execution error: ${String(err)}`
      };
    }
  }

  /**
   * Convert to JSON Schema for API calls
   */
  toJSONSchema(): Record<string, unknown> {
    return {
      name: this.name,
      description: this.description,
      parameters: zodToJsonSchema(this.parameters),
      requiresApproval: this.requiresApproval,
      category: this.category
    };
  }
}

/**
 * Convert Zod schema to JSON Schema (simplified)
 */
function zodToJsonSchema(schema: ZodSchema): Record<string, unknown> {
  const def = schema as any;
  
  if (def._def?.typeName === 'ZodObject') {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(def._def.shape())) {
      const propSchema = value as ZodSchema;
      properties[key] = zodToJsonSchema(propSchema);
      
      if (!propSchema.isOptional()) {
        required.push(key);
      }
    }
    
    return {
      type: 'object',
      properties,
      required
    };
  }
  
  if (def._def?.typeName === 'ZodString') {
    return { type: 'string' };
  }
  
  if (def._def?.typeName === 'ZodNumber') {
    return { type: 'number' };
  }
  
  if (def._def?.typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }
  
  if (def._def?.typeName === 'ZodArray') {
    return {
      type: 'array',
      items: zodToJsonSchema(def._def.type)
    };
  }
  
  if (def._def?.typeName === 'ZodEnum') {
    return {
      type: 'string',
      enum: def._def.values
    };
  }
  
  return { type: 'any' };
}

/**
 * Helper to create a tool with type inference
 */
export function createTool<T extends ZodSchema>(config: ToolConfig<T>): Tool<T> {
  return new Tool(config);
}
