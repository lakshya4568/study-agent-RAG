/**
 * RAG + MCP Integration Service
 * Combines NVIDIA RAG capabilities with MCP tool calling
 */

import { ragClient } from "../rag/rag-client";
import { mcpToolService } from "../client/MCPToolService";
import type { MCPToolMetadata } from "../client/MCPToolService";
import { logger } from "../client/logger";

export interface RAGWithToolsQuery {
  query: string;
  threadId?: string;
  useTools?: boolean;
  requireApproval?: boolean;
}

export interface RAGWithToolsResponse {
  answer: string;
  sources?: string[];
  toolsUsed?: Array<{
    toolName: string;
    serverId: string;
    args?: Record<string, unknown>;
    result?: unknown;
    approved: boolean;
  }>;
  error?: string;
}

export class RAGMCPIntegrationService {
  /**
   * Query the RAG system with MCP tool calling support
   */
  async queryWithTools(
    query: string,
    availableTools: MCPToolMetadata[],
    requireApproval = true
  ): Promise<RAGWithToolsResponse> {
    try {
      // Step 1: Send query to NVIDIA RAG backend with tool metadata
      logger.info("Querying RAG with tool support", {
        query,
        toolCount: availableTools.length,
        requireApproval,
      });

      // Format tools for the RAG backend
      const toolsPayload = availableTools.map((tool) => ({
        name: tool.name,
        description: tool.description || "No description",
        inputSchema: tool.inputSchema,
        serverId: tool.serverId,
        serverName: tool.serverName,
      }));

      // Call the NVIDIA RAG agent endpoint with tools
      const ragResponse = await ragClient.queryAgent(query, toolsPayload);

      if (!ragResponse.success) {
        return {
          answer: ragResponse.answer || "Query failed",
          error: ragResponse.error,
        };
      }

      // Step 2: Handle tool calls if present
      const toolsUsed: RAGWithToolsResponse["toolsUsed"] = [];

      if (ragResponse.tool_calls && ragResponse.tool_calls.length > 0) {
        logger.info("LLM requested tool execution", {
          toolCount: ragResponse.tool_calls.length,
        });

        for (const toolCall of ragResponse.tool_calls) {
          const tool = availableTools.find((t) => t.name === toolCall.name);
          if (!tool) {
            logger.warn(`Tool not found: ${toolCall.name}`);
            continue;
          }

          // Request tool execution with approval flow
          const request = await mcpToolService.requestToolExecution(
            toolCall.name,
            tool.serverId,
            tool.serverName,
            toolCall.arguments,
            tool.description
          );

          logger.info("Tool execution requested, awaiting approval", {
            requestId: request.id,
            toolName: toolCall.name,
          });

          if (requireApproval) {
            // Wait for user approval/denial
            const approval = await mcpToolService.waitForApproval(request.id);

            if (approval.approved) {
              toolsUsed.push({
                toolName: toolCall.name,
                serverId: tool.serverId,
                args: toolCall.arguments,
                result: approval.result,
                approved: true,
              });
            } else {
              toolsUsed.push({
                toolName: toolCall.name,
                serverId: tool.serverId,
                args: toolCall.arguments,
                approved: false,
              });
            }
          } else {
            // Auto-approve and execute
            await mcpToolService.approveExecution(request.id);
            const execRequest = mcpToolService.getRequest(request.id);

            toolsUsed.push({
              toolName: toolCall.name,
              serverId: tool.serverId,
              args: toolCall.arguments,
              result: execRequest?.result,
              approved: true,
            });
          }
        }
      }

      return {
        answer: ragResponse.answer,
        sources: ragResponse.sources,
        toolsUsed,
      };
    } catch (error) {
      logger.error("RAG with tools query failed", error);
      return {
        answer: "I encountered an error processing your request.",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get tool descriptions formatted for the LLM
   */
  formatToolsForLLM(tools: MCPToolMetadata[]): string {
    if (tools.length === 0) {
      return "No tools available.";
    }

    return tools
      .map(
        (tool) =>
          `- ${tool.name} (${tool.serverName}): ${tool.description || "No description"}`
      )
      .join("\n");
  }
}

// Export singleton instance
export const ragMCPService = new RAGMCPIntegrationService();
