/**
 * MCPToolService - Integrates MCP tools with LLM chat
 * Handles tool discovery, execution approval, and result handling
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { PendingToolCall } from "../components/ui";
import type { MCPClientManager } from "./MCPClientManager";

export interface MCPToolMetadata extends Tool {
  serverId: string;
  serverName: string;
}

export interface ToolExecutionRequest {
  id: string;
  toolName: string;
  serverId: string;
  serverName: string;
  args?: Record<string, unknown>;
  description?: string;
  status:
    | "pending"
    | "approved"
    | "denied"
    | "executing"
    | "completed"
    | "failed";
  result?: unknown;
  error?: string;
  timestamp: Date;
}

export class MCPToolService {
  private pendingRequests = new Map<string, ToolExecutionRequest>();
  private executionCallbacks = new Map<
    string,
    {
      onApprove: (result: unknown) => void;
      onDeny: () => void;
      onError: (error: string) => void;
    }
  >();
  private mcpManager?: MCPClientManager;

  setMCPManager(manager: MCPClientManager) {
    this.mcpManager = manager;
  }

  /**
   * Request tool execution with user approval
   */
  async requestToolExecution(
    toolName: string,
    serverId: string,
    serverName: string,
    args?: Record<string, unknown>,
    description?: string
  ): Promise<ToolExecutionRequest> {
    const requestId = `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const request: ToolExecutionRequest = {
      id: requestId,
      toolName,
      serverId,
      serverName,
      args,
      description,
      status: "pending",
      timestamp: new Date(),
    };

    this.pendingRequests.set(requestId, request);
    return request;
  }

  /**
   * Wait for user approval/denial of tool execution
   */
  waitForApproval(
    requestId: string
  ): Promise<{ approved: boolean; result?: unknown }> {
    return new Promise((resolve, reject) => {
      this.executionCallbacks.set(requestId, {
        onApprove: (result) => {
          resolve({ approved: true, result });
        },
        onDeny: () => {
          resolve({ approved: false });
        },
        onError: (error) => {
          reject(new Error(error));
        },
      });
    });
  }

  /**
   * Approve a pending tool execution
   */
  async approveExecution(requestId: string): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Tool request ${requestId} not found`);
    }

    request.status = "approved";
    this.pendingRequests.set(requestId, request);

    // Execute the tool
    try {
      request.status = "executing";
      this.pendingRequests.set(requestId, request);

      if (!this.mcpManager) {
        throw new Error("MCPManager not initialized in MCPToolService");
      }

      const result = await this.mcpManager.executeTool(
        request.serverId,
        request.toolName,
        request.args
      );

      if (result.success) {
        request.status = "completed";
        request.result = result.content;
      } else {
        request.status = "failed";
        request.error = result.error;
      }

      this.pendingRequests.set(requestId, request);

      // Notify waiting promise
      const callback = this.executionCallbacks.get(requestId);
      if (callback) {
        if (result.success) {
          callback.onApprove(result.content);
        } else {
          callback.onError(result.error || "Unknown error");
        }
        this.executionCallbacks.delete(requestId);
      }
    } catch (error) {
      request.status = "failed";
      request.error = error instanceof Error ? error.message : String(error);
      this.pendingRequests.set(requestId, request);

      const callback = this.executionCallbacks.get(requestId);
      if (callback) {
        callback.onError(request.error);
        this.executionCallbacks.delete(requestId);
      }
    }
  }

  /**
   * Deny a pending tool execution
   */
  denyExecution(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Tool request ${requestId} not found`);
    }

    request.status = "denied";
    this.pendingRequests.set(requestId, request);

    // Notify waiting promise
    const callback = this.executionCallbacks.get(requestId);
    if (callback) {
      callback.onDeny();
      this.executionCallbacks.delete(requestId);
    }
  }

  /**
   * Get all pending tool execution requests
   */
  getPendingRequests(): ToolExecutionRequest[] {
    return Array.from(this.pendingRequests.values()).filter(
      (req) => req.status === "pending"
    );
  }

  /**
   * Get a specific request by ID
   */
  getRequest(requestId: string): ToolExecutionRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  /**
   * Clear completed/denied/failed requests older than 5 minutes
   */
  clearOldRequests(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    for (const [id, request] of this.pendingRequests.entries()) {
      if (
        request.status !== "pending" &&
        request.status !== "approved" &&
        request.status !== "executing" &&
        request.timestamp.getTime() < fiveMinutesAgo
      ) {
        this.pendingRequests.delete(id);
        this.executionCallbacks.delete(id);
      }
    }
  }

  /**
   * Convert a tool execution request to a PendingToolCall for UI
   */
  toPendingToolCall(request: ToolExecutionRequest): PendingToolCall {
    return {
      id: request.id,
      toolName: request.toolName,
      serverId: request.serverId,
      serverName: request.serverName,
      args: request.args,
      description: request.description,
      timestamp: request.timestamp,
    };
  }
}

// Export singleton instance
export const mcpToolService = new MCPToolService();
