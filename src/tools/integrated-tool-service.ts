/**
 * Tool Call Integration - Connects regex parser with MCP execution
 *
 * This service bridges the gap between LLM output and MCP tool execution:
 * 1. Parse LLM response for tool calls (regex-based)
 * 2. Validate and sanitize arguments
 * 3. Request user approval if needed
 * 4. Execute via MCP
 * 5. Return structured results
 */

import {
  ToolCallParser,
  ToolRegistry,
  createToolRegistryFromMCP,
  type ParsedToolCall,
  type ToolValidationResult,
} from "./tool-call-parser";
import type { MCPClientManager } from "../client/MCPClientManager";
import { mcpToolService } from "../client";
import { logger } from "../client/logger";

export interface ToolExecutionOptions {
  requireApproval?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  approved?: boolean;
  retries?: number;
}

export interface BatchToolExecutionResult {
  results: ToolExecutionResult[];
  successCount: number;
  failureCount: number;
  deniedCount: number;
}

/**
 * Integrated Tool Call Service
 * Combines parsing, validation, approval, and execution
 */
export class IntegratedToolCallService {
  private parser?: ToolCallParser;
  private registry?: ToolRegistry;

  constructor(private mcpManager: MCPClientManager) {}

  /**
   * Initialize registry from current MCP tools
   */
  async initialize() {
    logger.info("Initializing IntegratedToolCallService...");

    // Get all available MCP tools
    const allTools = this.mcpManager.getAllTools();

    // Create registry
    this.registry = createToolRegistryFromMCP(
      allTools.map((t: { name: string; description?: string }) => ({
        name: t.name,
        description: t.description,
        // Note: schema needs to be extracted/converted if available
      }))
    );

    this.parser = new ToolCallParser(this.registry);

    logger.info(`Initialized tool registry with ${allTools.length} tools`);
  }

  /**
   * Parse LLM output and execute discovered tool calls
   */
  async parseAndExecute(
    llmOutput: string,
    options: ToolExecutionOptions = {}
  ): Promise<BatchToolExecutionResult> {
    if (!this.parser || !this.registry) {
      throw new Error("IntegratedToolCallService not initialized");
    }

    const {
      requireApproval = true,
      autoRetry = true,
      maxRetries = 2,
    } = options;

    // Parse the output
    const parseResult = this.parser.parse(llmOutput);

    if (!parseResult.success || parseResult.toolCalls.length === 0) {
      logger.info("No tool calls found in LLM output");
      return {
        results: [],
        successCount: 0,
        failureCount: 0,
        deniedCount: 0,
      };
    }

    logger.info(
      `Found ${parseResult.toolCalls.length} tool call(s) in LLM output`
    );

    // Execute each tool call
    const results: ToolExecutionResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    let deniedCount = 0;

    for (const toolCall of parseResult.toolCalls) {
      const result = await this.executeSingleTool(
        toolCall,
        requireApproval,
        autoRetry,
        maxRetries
      );

      results.push(result);

      if (result.success) successCount++;
      else if (result.approved === false) deniedCount++;
      else failureCount++;
    }

    return {
      results,
      successCount,
      failureCount,
      deniedCount,
    };
  }

  /**
   * Execute a single parsed tool call
   */
  private async executeSingleTool(
    toolCall: ParsedToolCall,
    requireApproval: boolean,
    autoRetry: boolean,
    maxRetries: number
  ): Promise<ToolExecutionResult> {
    if (!this.parser) {
      throw new Error("Parser not initialized");
    }

    // Validate the tool call
    const validation = this.parser.validate(toolCall);

    if (!validation.valid) {
      logger.warn(`Invalid tool call: ${toolCall.toolName}`, validation.errors);
      return {
        success: false,
        toolName: toolCall.toolName,
        args: toolCall.args,
        error: `Validation failed: ${validation.errors.join(", ")}`,
      };
    }

    // Use sanitized args
    const sanitizedArgs = validation.sanitizedArgs || toolCall.args;

    // Get server info for this tool
    const serverInfo = await this.findServerForTool(toolCall.toolName);
    if (!serverInfo) {
      return {
        success: false,
        toolName: toolCall.toolName,
        args: sanitizedArgs,
        error: "Tool not found in any connected MCP server",
      };
    }

    // Execute with optional approval
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        if (requireApproval) {
          // Request approval
          const request = await mcpToolService.requestToolExecution(
            toolCall.toolName,
            serverInfo.serverId,
            serverInfo.serverName,
            sanitizedArgs,
            toolCall.rawMatch
          );

          // Wait for user decision
          const approval = await mcpToolService.waitForApproval(request.id);

          if (!approval.approved) {
            logger.info(`Tool execution denied: ${toolCall.toolName}`);
            return {
              success: false,
              toolName: toolCall.toolName,
              args: sanitizedArgs,
              approved: false,
              error: "User denied execution",
            };
          }
        }

        // Execute the tool
        logger.info(
          `Executing tool: ${toolCall.toolName} on server: ${serverInfo.serverName}`
        );
        const result = await this.mcpManager.executeTool(
          serverInfo.serverId,
          toolCall.toolName,
          sanitizedArgs
        );

        return {
          success: true,
          toolName: toolCall.toolName,
          args: sanitizedArgs,
          result: result.content,
          approved: requireApproval ? true : undefined,
          retries,
        };
      } catch (error) {
        logger.error(
          `Tool execution failed (attempt ${retries + 1}/${maxRetries + 1})`,
          error
        );

        if (!autoRetry || retries >= maxRetries) {
          return {
            success: false,
            toolName: toolCall.toolName,
            args: sanitizedArgs,
            error: error instanceof Error ? error.message : String(error),
            retries,
          };
        }

        retries++;
        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retries) * 1000)
        );
      }
    }

    return {
      success: false,
      toolName: toolCall.toolName,
      args: sanitizedArgs,
      error: "Max retries exceeded",
      retries,
    };
  }

  /**
   * Find which server provides a given tool
   */
  private async findServerForTool(toolName: string): Promise<
    | {
        serverId: string;
        serverName: string;
      }
    | undefined
  > {
    const servers = this.mcpManager.getAllServers();

    for (const server of servers) {
      if (server.status !== "connected") continue;

      if (server.tools.some((t: { name: string }) => t.name === toolName)) {
        return {
          serverId: server.config.id,
          serverName: server.config.name,
        };
      }
    }

    return undefined;
  }

  /**
   * Parse without executing (for preview/testing)
   */
  parseOnly(text: string) {
    if (!this.parser) {
      throw new Error("Parser not initialized");
    }
    return this.parser.parseAndValidate(text);
  }

  /**
   * Validate a specific tool call
   */
  validateToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): ToolValidationResult | null {
    if (!this.parser) {
      throw new Error("Parser not initialized");
    }

    return this.parser.validate({
      toolName,
      args,
      confidence: "high",
      rawMatch: "",
      format: "function",
    });
  }

  /**
   * Get all registered tool names
   */
  getAvailableTools(): string[] {
    if (!this.registry) {
      return [];
    }
    return this.registry.getAllToolNames();
  }
}

/**
 * Global singleton instance
 */
export let integratedToolService: IntegratedToolCallService | null = null;

/**
 * Initialize the integrated tool service
 */
export async function initializeIntegratedToolService(
  mcpManager: MCPClientManager
): Promise<IntegratedToolCallService> {
  integratedToolService = new IntegratedToolCallService(mcpManager);
  await integratedToolService.initialize();
  return integratedToolService;
}
