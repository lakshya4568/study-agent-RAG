/**
 * Tool Schema Enricher - Enhances MCP tool schemas with rich descriptions and examples
 *
 * This module ensures LLMs understand:
 * 1. When to use each tool
 * 2. What arguments are required/optional
 * 3. Expected formats and examples
 * 4. Default values and constraints
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
 * Registry of tool enhancements
 * Maps tool names to enhanced schemas with examples
 */
const TOOL_ENHANCEMENTS: Record<string, Partial<EnrichedToolSchema>> = {
  // Time-related tools
  current_time: {
    description:
      "Get the current time in a specified timezone or UTC by default. Use this when the user asks 'what time is it?', 'current time', or similar queries.",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "IANA timezone name (e.g., 'America/New_York', 'Asia/Tokyo', 'Europe/London'). Defaults to 'UTC' if not specified.",
          examples: ["America/New_York", "Asia/Tokyo", "UTC", "Europe/London"],
          default: "UTC",
        },
        format: {
          type: "string",
          description:
            "Time format string. Common formats: 'RFC3339' (default), 'DateOnly', 'TimeOnly', 'Kitchen'. See mcp-time documentation for all options.",
          examples: ["RFC3339", "Kitchen", "DateOnly"],
          default: "RFC3339",
        },
      },
      required: [],
    },
    examples: [
      {
        userQuery: "What's the current time?",
        toolCall: {
          arguments: {},
          expectedBehavior: "Returns current UTC time in RFC3339 format",
        },
      },
      {
        userQuery: "What time is it in New York?",
        toolCall: {
          arguments: { timezone: "America/New_York" },
          expectedBehavior: "Returns current time in New York timezone",
        },
      },
      {
        userQuery: "Show me the current time in a readable format",
        toolCall: {
          arguments: { format: "Kitchen" },
          expectedBehavior: "Returns time like '3:04PM'",
        },
      },
    ],
  },

  add_time: {
    description:
      "Add or subtract a duration from a given time. Use positive duration to add (e.g., '2h') or negative to subtract (e.g., '-30m'). This is useful for time calculations and scheduling.",
    parameters: {
      type: "object",
      properties: {
        duration: {
          type: "string",
          description:
            "Duration to add/subtract. Format: '1h2m3s' for 1 hour, 2 minutes, 3 seconds. Use negative for subtraction: '-1h'. Units: h (hours), m (minutes), s (seconds).",
          examples: ["2h", "-30m", "1h30m", "45s", "-2h15m"],
        },
        time: {
          type: "string",
          description:
            "Starting time in any parseable format (ISO8601 recommended: 'YYYY-MM-DDTHH:mm:ssZ'). Defaults to current time if not provided.",
          examples: [
            "2025-11-19T15:40:19+05:30",
            "2025-11-19T10:00:00Z",
            "now",
          ],
          default: "now",
        },
        format: {
          type: "string",
          description: "Output time format (default: RFC3339)",
          default: "RFC3339",
        },
        timezone: {
          type: "string",
          description: "Target timezone for output (IANA format, default: UTC)",
          default: "UTC",
        },
      },
      required: ["duration"],
    },
    examples: [
      {
        userQuery: "What time will it be 2 hours from now?",
        toolCall: {
          arguments: { duration: "2h" },
          expectedBehavior:
            "Adds 2 hours to current time and returns the result",
        },
      },
      {
        userQuery: "Add 30 minutes to 3:00 PM",
        toolCall: {
          arguments: { time: "2025-11-19T15:00:00Z", duration: "30m" },
          expectedBehavior: "Returns 3:30 PM",
        },
      },
      {
        userQuery: "What was the time 1 hour ago?",
        toolCall: {
          arguments: { duration: "-1h" },
          expectedBehavior: "Subtracts 1 hour from current time",
        },
      },
    ],
  },

  convert_timezone: {
    description:
      "Convert a time from one timezone to another. Essential for coordinating across time zones or understanding when an event occurs in different locations.",
    parameters: {
      type: "object",
      properties: {
        time: {
          type: "string",
          description:
            "Time to convert (ISO8601 format: 'YYYY-MM-DDTHH:mm:ssZ' or with timezone offset). Can also be 'now' for current time.",
          examples: ["2025-11-19T15:40:19+05:30", "2025-11-19T10:00:00Z"],
        },
        input_timezone: {
          type: "string",
          description:
            "Source timezone (IANA format). If the time string includes a timezone, this takes precedence.",
          examples: ["America/New_York", "Asia/Kolkata", "UTC"],
          default: "UTC",
        },
        output_timezone: {
          type: "string",
          description: "Target timezone (IANA format) for the output time",
          examples: ["America/Los_Angeles", "Europe/London", "Asia/Tokyo"],
          default: "UTC",
        },
        format: {
          type: "string",
          description: "Output time format (default: RFC3339)",
          default: "RFC3339",
        },
      },
      required: ["time", "input_timezone", "output_timezone"],
    },
    examples: [
      {
        userQuery: "Convert 3PM IST to New York time",
        toolCall: {
          arguments: {
            time: "2025-11-19T15:00:00+05:30",
            input_timezone: "Asia/Kolkata",
            output_timezone: "America/New_York",
          },
          expectedBehavior: "Returns the equivalent time in New York timezone",
        },
      },
      {
        userQuery: "What time is 10AM UTC in Tokyo?",
        toolCall: {
          arguments: {
            time: "2025-11-19T10:00:00Z",
            input_timezone: "UTC",
            output_timezone: "Asia/Tokyo",
          },
          expectedBehavior: "Returns 7PM JST (Tokyo time)",
        },
      },
    ],
  },

  compare_time: {
    description:
      "Compare two times to determine which is earlier, later, or if they're equal. Returns -1 if time_a is before time_b, 0 if equal, 1 if time_a is after time_b.",
    parameters: {
      type: "object",
      properties: {
        time_a: {
          type: "string",
          description: "First time to compare (ISO8601 format)",
          examples: ["2025-11-19T15:00:00Z"],
        },
        time_b: {
          type: "string",
          description: "Second time to compare (ISO8601 format)",
          examples: ["2025-11-19T16:00:00Z"],
        },
        time_a_timezone: {
          type: "string",
          description: "Timezone for time_a (default: UTC)",
          default: "UTC",
        },
        time_b_timezone: {
          type: "string",
          description: "Timezone for time_b (default: UTC)",
          default: "UTC",
        },
      },
      required: ["time_a", "time_b"],
    },
    examples: [
      {
        userQuery: "Is 3PM earlier than 5PM?",
        toolCall: {
          arguments: {
            time_a: "2025-11-19T15:00:00Z",
            time_b: "2025-11-19T17:00:00Z",
          },
          expectedBehavior: "Returns -1 (time_a is earlier)",
        },
      },
    ],
  },

  relative_time: {
    description:
      "Parse natural language time expressions like 'yesterday', '5 minutes ago', 'next week', 'tomorrow at 3pm'. Converts human-friendly time descriptions to actual timestamps.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "Natural language time expression. Examples: 'now', 'yesterday', '5 minutes ago', 'next Monday at 10am', 'last month', 'tomorrow at 3:30pm'",
          examples: [
            "now",
            "yesterday",
            "5 minutes ago",
            "next Monday at 10am",
            "tomorrow at 3pm",
            "last week",
          ],
        },
        time: {
          type: "string",
          description: "Reference time (default: current time)",
          default: "now",
        },
        timezone: {
          type: "string",
          description: "Target timezone (default: UTC)",
          default: "UTC",
        },
        format: {
          type: "string",
          description: "Output format (default: RFC3339)",
          default: "RFC3339",
        },
      },
      required: ["text"],
    },
    examples: [
      {
        userQuery: "When is tomorrow at 3pm?",
        toolCall: {
          arguments: { text: "tomorrow at 3pm" },
          expectedBehavior: "Returns timestamp for 3pm tomorrow",
        },
      },
      {
        userQuery: "What was the date 5 days ago?",
        toolCall: {
          arguments: { text: "5 days ago" },
          expectedBehavior: "Returns timestamp for 5 days before now",
        },
      },
    ],
  },

  // Add more tool enhancements as needed
};

/**
 * Enrich a tool's schema with detailed descriptions and examples
 */
export function enrichToolSchema(tool: Tool): EnrichedToolSchema {
  const enhancement = TOOL_ENHANCEMENTS[tool.name];

  if (!enhancement) {
    // Return basic enrichment if no specific enhancement exists
    return {
      name: tool.name,
      description:
        tool.description ||
        `Execute the ${tool.name} tool with provided arguments.`,
      parameters: (tool.inputSchema as EnrichedToolSchema["parameters"]) || {
        type: "object",
        properties: {},
      },
    };
  }

  // Merge original schema with enhancements
  const enriched: EnrichedToolSchema = {
    name: tool.name,
    description: enhancement.description || tool.description || "",
    parameters: {
      type: "object",
      properties: {
        ...(tool.inputSchema as any)?.properties,
        ...enhancement.parameters?.properties,
      },
      required:
        enhancement.parameters?.required ||
        (tool.inputSchema as any)?.required ||
        [],
    },
    examples: enhancement.examples,
  };

  logger.debug(`Enriched schema for tool: ${tool.name}`);
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
