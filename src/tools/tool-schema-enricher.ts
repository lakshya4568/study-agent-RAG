/**
 * Tool Schema Enricher - Dynamically enhances MCP tool schemas with rich descriptions
 *
 * This module ensures LLMs understand:
 * 1. When to use each tool
 * 2. What arguments are required/optional
 * 3. Expected formats and examples
 * 4. Default values and constraints
 *
 * All enrichment is DYNAMIC - no hardcoding required!
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { logger } from "../client/logger";

/**
 * Enhanced tool metadata for better LLM understanding
 */
export interface EnrichedToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ParameterSchema>;
    required?: string[];
  };
  examples?: ToolExample[];
}

export interface ParameterSchema {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
  format?: string;
  examples?: unknown[];
}

export interface ToolExample {
  userQuery: string;
  toolCall: {
    arguments: Record<string, unknown>;
    expectedBehavior: string;
  };
}

/**
 * Dynamically extract default values from JSON schema
 */
function extractDefaults(schema: unknown): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  if (!schema || typeof schema !== "object") {
    return defaults;
  }

  const schemaObj = schema as { properties?: Record<string, unknown> };
  if (!schemaObj.properties) {
    return defaults;
  }

  for (const [key, propSchema] of Object.entries(schemaObj.properties)) {
    if (
      propSchema &&
      typeof propSchema === "object" &&
      "default" in propSchema
    ) {
      defaults[key] = (propSchema as { default: unknown }).default;
    }
  }

  return defaults;
}

/**
 * Generate example values based on parameter type and description
 */
function generateExampleValue(
  paramName: string,
  paramSchema: unknown
): unknown[] {
  const examples: unknown[] = [];

  if (!paramSchema || typeof paramSchema !== "object") {
    return [];
  }

  const schema = paramSchema as {
    examples?: unknown[];
    example?: unknown;
    enum?: unknown[];
    type?: string;
    description?: string;
  };

  // Use existing examples if available
  if (schema.examples) {
    return schema.examples;
  }
  if (schema.example) {
    return [schema.example];
  }

  // Generate based on enum
  if (schema.enum) {
    return schema.enum.slice(0, 3);
  }

  // Generate based on type
  const type = schema.type;
  const description = schema.description?.toLowerCase() || "";

  if (type === "string") {
    // Context-aware string examples
    if (description.includes("timezone") || description.includes("iana")) {
      return ["America/New_York", "Europe/London", "Asia/Tokyo"];
    }
    if (description.includes("time") && description.includes("format")) {
      return ["RFC3339", "DateOnly", "Kitchen"];
    }
    if (description.includes("duration")) {
      return ["2h", "30m", "1h30m"];
    }
    if (description.includes("date") || description.includes("timestamp")) {
      return ["2025-11-19T10:00:00Z", "2025-11-19T15:30:00+05:30"];
    }
    if (description.includes("url") || description.includes("uri")) {
      return ["https://example.com", "https://api.example.com/endpoint"];
    }
    if (description.includes("path") || description.includes("file")) {
      return ["/path/to/file.txt", "./documents/example.pdf"];
    }
    if (description.includes("email")) {
      return ["user@example.com", "contact@domain.com"];
    }
    return [`example_${paramName}`, `sample_${paramName}`];
  }

  if (type === "number" || type === "integer") {
    if (description.includes("port")) {
      return [8080, 3000, 5432];
    }
    if (description.includes("count") || description.includes("limit")) {
      return [10, 50, 100];
    }
    if (description.includes("percentage") || description.includes("percent")) {
      return [50, 75, 100];
    }
    return [1, 10, 100];
  }

  if (type === "boolean") {
    return [true, false];
  }

  if (type === "array") {
    return [["item1", "item2"], ["example"]];
  }

  return [];
}

/**
 * Generate a natural usage example for a tool
 */
function generateToolExample(
  toolName: string,
  toolDescription: string,
  parameters: unknown
): ToolExample | null {
  if (!parameters || typeof parameters !== "object") {
    return null;
  }

  const params = parameters as {
    required?: string[];
    properties?: Record<string, unknown>;
  };

  const required = Array.isArray(params.required) ? params.required : [];
  const properties = params.properties || {};

  // Create example arguments using only required params + common optional ones
  const exampleArgs: Record<string, unknown> = {};

  for (const paramName of required) {
    const paramSchema = properties[paramName];
    if (paramSchema) {
      const examples = generateExampleValue(paramName, paramSchema);
      exampleArgs[paramName] = examples[0] || `example_${paramName}`;
    }
  }

  // Generate a natural user query based on tool name and description
  const userQuery = generateNaturalQuery(
    toolName,
    toolDescription,
    exampleArgs
  );

  return {
    userQuery,
    toolCall: {
      arguments: exampleArgs,
      expectedBehavior: `Uses ${toolName} to ${toolDescription.split(".")[0].toLowerCase()}`,
    },
  };
}

/**
 * Generate natural language query for a tool
 */
function generateNaturalQuery(
  toolName: string,
  description: string,
  args: Record<string, unknown>
): string {
  const name = toolName.replace(/_/g, " ");

  // Extract action verb from description
  const actionMatch = description.match(
    /^(get|fetch|retrieve|create|update|delete|search|find|list|show|calculate|convert|compare|add|remove|generate|parse)/i
  );
  const action = actionMatch ? actionMatch[1].toLowerCase() : "use";

  // Context-aware query generation
  if (toolName.includes("time") || toolName.includes("date")) {
    if (action === "get" || action === "fetch") {
      return `What's the current ${name}?`;
    }
    if (action === "convert") {
      return `Convert time between timezones`;
    }
    if (action === "add" || action === "calculate") {
      return `Calculate time in the future`;
    }
  }

  if (toolName.includes("search") || toolName.includes("find")) {
    return `Search for ${Object.keys(args)[0] || "information"}`;
  }

  if (toolName.includes("create") || toolName.includes("generate")) {
    return `Create a new ${name.replace("create ", "")}`;
  }

  if (toolName.includes("list") || toolName.includes("get")) {
    return `Show me ${name.replace("get ", "").replace("list ", "")}`;
  }

  // Fallback: use action + tool name
  return `${action.charAt(0).toUpperCase() + action.slice(1)} ${name}`;
}

/**
 * Enrich parameter descriptions dynamically
 */
function enrichParameterDescription(
  paramName: string,
  paramSchema: unknown
): string {
  if (!paramSchema || typeof paramSchema !== "object") {
    return `${paramName} parameter`;
  }

  const schema = paramSchema as {
    description?: string;
    type?: string;
    enum?: unknown[];
    default?: unknown;
    format?: string;
    minimum?: number;
    maximum?: number;
    pattern?: string;
  };

  let description = schema.description || `${paramName} parameter`;

  // Add type information
  const type = schema.type;
  if (type && !description.toLowerCase().includes(type)) {
    description += ` (${type})`;
  }

  // Add enum info
  if (schema.enum) {
    const enumValues = schema.enum.map((v) => String(v)).join(", ");
    description += `. Allowed values: ${enumValues}`;
  }

  // Add default info
  if (schema.default !== undefined) {
    description += `. Defaults to: ${JSON.stringify(schema.default)}`;
  }

  // Add format info
  if (schema.format) {
    description += `. Format: ${schema.format}`;
  }

  // Add range info for numbers
  if (type === "number" || type === "integer") {
    if (schema.minimum !== undefined) {
      description += `. Minimum: ${schema.minimum}`;
    }
    if (schema.maximum !== undefined) {
      description += `. Maximum: ${schema.maximum}`;
    }
  }

  // Add pattern info for strings
  if (type === "string" && schema.pattern) {
    description += `. Pattern: ${schema.pattern}`;
  }

  return description;
}

/**
 * Dynamically enrich a tool's schema with detailed descriptions and examples
 */
export function enrichToolSchema(tool: Tool): EnrichedToolSchema {
  const inputSchema = tool.inputSchema;

  const schema = (
    inputSchema && typeof inputSchema === "object" ? inputSchema : {}
  ) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };

  const properties = schema.properties || {};
  const required = Array.isArray(schema.required) ? schema.required : [];

  // Extract defaults from schema
  const defaults = extractDefaults(inputSchema);

  // Enrich each parameter
  const enrichedProperties: Record<string, ParameterSchema> = {};

  for (const [paramName, paramSchema] of Object.entries(properties)) {
    const pSchema = (
      paramSchema && typeof paramSchema === "object" ? paramSchema : {}
    ) as {
      type?: string;
      enum?: unknown[];
      default?: unknown;
      format?: string;
    };

    enrichedProperties[paramName] = {
      type: pSchema.type || "string",
      description: enrichParameterDescription(paramName, paramSchema),
      enum: pSchema.enum as string[] | undefined,
      default: pSchema.default || defaults[paramName],
      format: pSchema.format,
      examples: generateExampleValue(paramName, paramSchema),
    };
  }

  // Generate example usage
  const example = generateToolExample(tool.name, tool.description || "", {
    properties: enrichedProperties,
    required,
  });

  const enriched: EnrichedToolSchema = {
    name: tool.name,
    description:
      tool.description || `Execute ${tool.name.replace(/_/g, " ")} operation`,
    parameters: {
      type: "object",
      properties: enrichedProperties,
      required,
    },
    examples: example ? [example] : undefined,
  };

  logger.debug(`Dynamically enriched schema for tool: ${tool.name}`);
  return enriched;
}

/**
 * Convert enriched schema to OpenAI ChatCompletionTool format
 */
export function toOpenAIToolFormat(
  enriched: EnrichedToolSchema
): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: enriched.name,
      description: enriched.description,
      parameters: enriched.parameters,
    },
  };
}

/**
 * Generate few-shot examples for system prompt
 */
export function generateFewShotExamples(tools: EnrichedToolSchema[]): string {
  const examples: string[] = [];

  for (const tool of tools) {
    if (tool.examples && tool.examples.length > 0) {
      for (const example of tool.examples.slice(0, 2)) {
        // Limit to 2 examples per tool
        examples.push(
          `User: ${example.userQuery}\nAssistant: I'll use the ${tool.name} tool with: ${JSON.stringify(example.toolCall.arguments)}\n(${example.toolCall.expectedBehavior})`
        );
      }
    }
  }

  return examples.join("\n\n");
}

/**
 * Enrich all tools in a list
 */
export function enrichAllTools(tools: Tool[]): EnrichedToolSchema[] {
  return tools.map(enrichToolSchema);
}

/**
 * Create enhanced system prompt with tool examples
 */
export function createToolAwareSystemPrompt(
  basePrompt: string,
  enrichedTools: EnrichedToolSchema[]
): string {
  const fewShotExamples = generateFewShotExamples(enrichedTools);

  if (!fewShotExamples) {
    return basePrompt;
  }

  return `${basePrompt}

## Tool Usage Examples

Here are examples of how to use the available tools correctly:

${fewShotExamples}

**Important Guidelines:**
- Always provide required arguments for tools
- Use default values when optional arguments are omitted
- Check parameter descriptions for format requirements
- Use examples as reference for proper argument formatting`;
}

/**
 * Validate tool call arguments against schema
 */
export function validateToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  schema: EnrichedToolSchema
): { valid: boolean; errors: string[]; defaults: Record<string, unknown> } {
  const errors: string[] = [];
  const defaults: Record<string, unknown> = {};

  // Check required arguments
  const required = schema.parameters.required || [];
  for (const reqArg of required) {
    if (!(reqArg in args) || args[reqArg] === undefined) {
      errors.push(`Missing required argument: ${reqArg}`);
    }
  }

  // Apply defaults for missing optional arguments
  for (const [paramName, paramSchema] of Object.entries(
    schema.parameters.properties
  )) {
    if (!(paramName in args) && paramSchema.default !== undefined) {
      defaults[paramName] = paramSchema.default;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    defaults,
  };
}

/**
 * Merge user-provided arguments with defaults
 */
export function mergeWithDefaults(
  args: Record<string, unknown>,
  defaults: Record<string, unknown>
): Record<string, unknown> {
  return { ...defaults, ...args };
}
