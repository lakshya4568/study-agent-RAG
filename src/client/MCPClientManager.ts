/* eslint-disable import/no-unresolved */
/**
 * MCPClientManager - Manages multiple MCP server connections
 */

import { MCPSession } from './MCPSession';
import { MCPServerConfig, ServerInfo, ServerStatus, ToolExecutionResult } from './types';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export class MCPClientManager {
  private sessions = new Map<string, MCPSession>();

  /**
   * Add and connect to a new MCP server
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.sessions.has(config.id)) {
      throw new Error(`Server with id ${config.id} already exists`);
    }

    const session = new MCPSession(config);
    this.sessions.set(config.id, session);

    try {
      await session.connect();
    } catch (error) {
      this.sessions.delete(config.id);
      throw error;
    }
  }

  /**
   * Remove and disconnect from a server
   */
  async removeServer(serverId: string): Promise<void> {
    const session = this.sessions.get(serverId);
    if (!session) {
      throw new Error(`Server with id ${serverId} not found`);
    }

    await session.disconnect();
    this.sessions.delete(serverId);
  }

  /**
   * Get information about a specific server
   */
  getServerInfo(serverId: string): ServerInfo | undefined {
    const session = this.sessions.get(serverId);
    if (!session) {
      return undefined;
    }

    return {
      config: session.config,
      status: session.status,
      tools: session.tools,
    };
  }

  /**
   * Get information about all servers
   */
  getAllServers(): ServerInfo[] {
    return Array.from(this.sessions.values()).map((session) => ({
      config: session.config,
      status: session.status,
      tools: session.tools,
    }));
  }

  /**
   * Get all available tools from all connected servers
   */
  getAllTools(): Array<Tool & { serverId: string }> {
    const tools: Array<Tool & { serverId: string }> = [];

    this.sessions.forEach((session, serverId) => {
      if (session.isConnected()) {
        session.tools.forEach((tool) => {
          tools.push({ ...tool, serverId });
        });
      }
    });

    return tools;
  }

  /**
   * Execute a tool on a specific server
   */
  async executeTool(
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const session = this.sessions.get(serverId);
    if (!session) {
      return {
        success: false,
        error: `Server with id ${serverId} not found`,
      };
    }

    if (!session.isConnected()) {
      return {
        success: false,
        error: `Server ${serverId} is not connected`,
      };
    }

    return session.executeTool(toolName, args);
  }

  /**
   * Find which server has a specific tool
   */
  findToolServer(toolName: string): string | undefined {
    for (const [serverId, session] of this.sessions.entries()) {
      if (session.isConnected()) {
        const hasTool = session.tools.some((tool) => tool.name === toolName);
        if (hasTool) {
          return serverId;
        }
      }
    }
    return undefined;
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.sessions.values()).map((session) =>
      session.disconnect()
    );
    await Promise.all(disconnectPromises);
    this.sessions.clear();
  }

  /**
   * Get the count of connected servers
   */
  getConnectedCount(): number {
    let count = 0;
    this.sessions.forEach((session) => {
      if (session.status === ServerStatus.CONNECTED) {
        count++;
      }
    });
    return count;
  }
}
