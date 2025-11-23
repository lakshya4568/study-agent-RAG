/**
 * Tool Call Parser - Regex-based parsing for flexible tool call formats
 *
 * Handles multiple formats:
 * 1. Function syntax: toolName(arg1='val1', arg2='val2')
 * 2. Natural language: "convert the time from Asia/Kolkata to America/New_York"
 * 3. JSON-like: {"tool": "toolName", "args": {...}}
 * 4. Mixed: LLM explanation with embedded tool calls
 */

import { z } from "zod";
import { logger } from "../client/logger";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ParsedToolCall {
  toolName: string;
  args: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  rawMatch: string;
  format: "function" | "json" | "natural" | "unknown";
}

export interface ToolCallParseResult {
  success: boolean;
  toolCalls: ParsedToolCall[];
  errors: string[];
  originalText: string;
}

export interface ToolValidationResult {
  valid: boolean;
  toolCall: ParsedToolCall;
  sanitizedArgs?: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

/**
 * Registry of available MCP tools with their schemas
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private schemas = new Map<string, z.ZodType<unknown>>();
  private aliases = new Map<string, string>(); // Natural language → tool name mapping

  registerTool(tool: Tool, schema?: z.ZodType<unknown>) {
    this.tools.set(tool.name, tool);
    if (schema) {
      this.schemas.set(tool.name, schema);
    }
    logger.debug(`Registered tool: ${tool.name}`);
  }

  registerAlias(alias: string, toolName: string) {
    this.aliases.set(alias.toLowerCase(), toolName);
  }

  getTool(name: string): Tool | undefined {
    return (
      this.tools.get(name) ||
      this.tools.get(this.aliases.get(name.toLowerCase()) || "")
    );
  }

  getSchema(toolName: string): z.ZodType<unknown> | undefined {
    return this.schemas.get(toolName);
  }

  getAllToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  hasToolName(name: string): boolean {
    return this.tools.has(name) || this.aliases.has(name.toLowerCase());
  }
}

/**
 * Main Tool Call Parser
 */
export class ToolCallParser {
  constructor(private registry: ToolRegistry) {}

  /**
   * Parse text for potential tool calls using multiple strategies
   */
  parse(text: string): ToolCallParseResult {
    const errors: string[] = [];
    const toolCalls: ParsedToolCall[] = [];

    try {
      // Strategy 1: Function syntax
      const functionCalls = this.parseFunctionSyntax(text);
      toolCalls.push(...functionCalls);

      // Strategy 2: JSON format
      const jsonCalls = this.parseJsonFormat(text);
      toolCalls.push(...jsonCalls);

      // Strategy 3: Natural language (if no structured calls found)
      if (toolCalls.length === 0) {
        const naturalCalls = this.parseNaturalLanguage(text);
        toolCalls.push(...naturalCalls);
      }

      // Deduplicate tool calls
      const uniqueCalls = this.deduplicateCalls(toolCalls);

      return {
        success: uniqueCalls.length > 0,
        toolCalls: uniqueCalls,
        errors,
        originalText: text,
      };
    } catch (error) {
      errors.push(
        `Parse error: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        success: false,
        toolCalls: [],
        errors,
        originalText: text,
      };
    }
  }

  /**
   * Parse function-style syntax: toolName(arg1='val', arg2='val')
   */
  private parseFunctionSyntax(text: string): ParsedToolCall[] {
    const calls: ParsedToolCall[] = [];

    // Pattern: toolName(arguments)
    // Supports: single quotes, double quotes, no quotes for simple values
    const functionPattern = /(\w+)\s*\(\s*([^)]*)\s*\)/gi;

    let match: RegExpExecArray | null;
    while ((match = functionPattern.exec(text)) !== null) {
      const toolName = match[1];
      const argsStr = match[2];

      // Verify this is a known tool
      if (!this.registry.hasToolName(toolName)) {
        continue;
      }

      // Parse arguments
      const args = this.parseArgumentString(argsStr);

      calls.push({
        toolName,
        args,
        confidence: "high",
        rawMatch: match[0],
        format: "function",
      });
    }

    return calls;
  }

  /**
   * Parse JSON format: {"tool": "toolName", "args": {...}}
   */
  private parseJsonFormat(text: string): ParsedToolCall[] {
    const calls: ParsedToolCall[] = [];

    // Try to find JSON objects in the text
    const jsonPattern = /\{[^{}]*"tool"[^{}]*\}/gi;

    let match: RegExpExecArray | null;
    while ((match = jsonPattern.exec(text)) !== null) {
      try {
        const jsonStr = match[0];
        const parsed = JSON.parse(jsonStr);

        if (parsed.tool && typeof parsed.tool === "string") {
          const toolName = parsed.tool;

          if (!this.registry.hasToolName(toolName)) {
            continue;
          }

          calls.push({
            toolName,
            args: parsed.args || {},
            confidence: "high",
            rawMatch: jsonStr,
            format: "json",
          });
        }
      } catch (e) {
        // Not valid JSON, skip
        logger.debug("Failed to parse JSON tool call", e);
      }
    }

    return calls;
  }

  /**
   * Parse natural language for tool hints
   * Example: "convert the time from Asia/Kolkata to America/New_York"
   */
  private parseNaturalLanguage(text: string): ParsedToolCall[] {
    const calls: ParsedToolCall[] = [];
    const lowerText = text.toLowerCase();

    // Check for time conversion patterns
    if (lowerText.includes("convert") && lowerText.includes("time")) {
      const timezonePattern =
        /(?:from\s+)?([a-z_]+\/[a-z_]+)(?:\s+to\s+)?([a-z_]+\/[a-z_]+)?/gi;
      const match = timezonePattern.exec(text);

      if (match && this.registry.hasToolName("convert_timezone")) {
        const args: Record<string, unknown> = {};
        if (match[1]) args.from_timezone = match[1];
        if (match[2]) args.to_timezone = match[2];

        calls.push({
          toolName: "convert_timezone",
          args,
          confidence: "medium",
          rawMatch: match[0],
          format: "natural",
        });
      }
    }

    // Check for current time requests
    if (lowerText.match(/what(?:'s| is) (?:the )?(?:current )?time/)) {
      if (this.registry.hasToolName("current_time")) {
        calls.push({
          toolName: "current_time",
          args: {},
          confidence: "high",
          rawMatch: text,
          format: "natural",
        });
      }
    }

    // Add more natural language patterns here as needed

    return calls;
  }

  /**
   * Parse argument string from function syntax
   * Handles: arg1='val1', arg2="val2", arg3=val3, arg4=123
   */
  private parseArgumentString(argsStr: string): Record<string, unknown> {
    const args: Record<string, unknown> = {};

    if (!argsStr || argsStr.trim() === "") {
      return args;
    }

    // Split by commas that are not inside quotes
    const argParts = this.splitArgumentString(argsStr);

    for (const part of argParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Match key=value pattern
      const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (!kvMatch) continue;

      const key = kvMatch[1];
      let value: unknown = kvMatch[2].trim();

      // Remove quotes
      if (typeof value === "string") {
        value = value.replace(/^['"](.*)['"]$/, "$1");

        // Try to parse as number/boolean
        if (value === "true") value = true;
        else if (value === "false") value = false;
        else if (!isNaN(Number(value)) && value !== "") {
          value = Number(value);
        }
      }

      args[key] = value;
    }

    return args;
  }

  /**
   * Split argument string by commas, respecting quotes
   */
  private splitArgumentString(str: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
        current += char;
      } else if (char === "," && !inQuotes) {
        parts.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Remove duplicate tool calls based on tool name and args similarity
   */
  private deduplicateCalls(calls: ParsedToolCall[]): ParsedToolCall[] {
    const seen = new Set<string>();
    const unique: ParsedToolCall[] = [];

    for (const call of calls) {
      const key = `${call.toolName}:${JSON.stringify(call.args)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(call);
      }
    }

    return unique;
  }

  /**
   * Validate and sanitize a parsed tool call
   */
  validate(toolCall: ParsedToolCall): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if tool exists
    const tool = this.registry.getTool(toolCall.toolName);
    if (!tool) {
      errors.push(`Unknown tool: ${toolCall.toolName}`);
      return { valid: false, toolCall, errors, warnings };
    }

    // Get schema if available
    const schema = this.registry.getSchema(toolCall.toolName);
    if (!schema) {
      warnings.push("No schema available for validation");
      return {
        valid: true,
        toolCall,
        sanitizedArgs: toolCall.args,
        errors,
        warnings,
      };
    }

    // Validate with Zod schema
    try {
      const sanitizedArgs = schema.parse(toolCall.args) as Record<
        string,
        unknown
      >;
      return {
        valid: true,
        toolCall,
        sanitizedArgs,
        errors,
        warnings,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(
          ...error.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
        );
      } else {
        errors.push(
          `Validation error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return { valid: false, toolCall, errors, warnings };
    }
  }

  /**
   * Parse and validate in one step
   */
  parseAndValidate(text: string): {
    validCalls: Array<{ call: ParsedToolCall; args: Record<string, unknown> }>;
    invalidCalls: Array<{ call: ParsedToolCall; errors: string[] }>;
    parseErrors: string[];
  } {
    const parseResult = this.parse(text);
    const validCalls: Array<{
      call: ParsedToolCall;
      args: Record<string, unknown>;
    }> = [];
    const invalidCalls: Array<{ call: ParsedToolCall; errors: string[] }> = [];

    for (const call of parseResult.toolCalls) {
      const validation = this.validate(call);
      if (validation.valid && validation.sanitizedArgs) {
        validCalls.push({ call, args: validation.sanitizedArgs });
      } else {
        invalidCalls.push({ call, errors: validation.errors });
      }
    }

    return {
      validCalls,
      invalidCalls,
      parseErrors: parseResult.errors,
    };
  }
}

/**
 * Utility to create default tool registry from MCP tools
 */
export function createToolRegistryFromMCP(
  tools: Array<{
    name: string;
    description?: string;
    schema?: z.ZodType<unknown>;
  }>
): ToolRegistry {
  const registry = new ToolRegistry();

  for (const tool of tools) {
    registry.registerTool(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.schema as unknown as Tool["inputSchema"],
      },
      tool.schema
    );
  }

  // Register common aliases for natural language parsing
  registry.registerAlias("convert time", "convert_timezone");
  registry.registerAlias("time conversion", "convert_timezone");
  registry.registerAlias("what time is it", "current_time");
  registry.registerAlias("current time", "current_time");

  return registry;
}
