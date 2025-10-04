/* eslint-disable import/no-unresolved */
/**
 * MCPSession - Manages a connection to a single MCP server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { Tool } from '@modelcontextprotocol/sdk/types';
import { MCPServerConfig, ServerStatus, ToolExecutionResult } from './types';

export class MCPSession {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private _status: ServerStatus = ServerStatus.DISCONNECTED;
  private _tools: Tool[] = [];
  private _config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this._config = config;
    this.client = new Client(
      {
        name: 'study-agent-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          roots: {
            listChanged: true,
          },
          sampling: {},
        },
      }
    );
  }

  /**
   * Get the current server status
   */
  get status(): ServerStatus {
    return this._status;
  }

  /**
   * Get the available tools
   */
  get tools(): Tool[] {
    return this._tools;
  }

  /**
   * Get the server configuration
   */
  get config(): MCPServerConfig {
    return this._config;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    try {
      this._status = ServerStatus.CONNECTING;

      // Create transport
      this.transport = new StdioClientTransport({
        command: this._config.command,
        args: this._config.args,
        env: this._config.env,
      });

      // Connect client
      await this.client.connect(this.transport);

      // Initialize and discover tools
      await this.discoverTools();

      this._status = ServerStatus.CONNECTED;
      console.log(`[MCPSession] Connected to ${this._config.name}`);
    } catch (error) {
      this._status = ServerStatus.ERROR;
      console.error(`[MCPSession] Failed to connect to ${this._config.name}:`, error);
      throw error;
    }
  }

  /**
   * Discover available tools from the server
   */
  private async discoverTools(): Promise<void> {
    try {
      const response = await this.client.listTools();
      this._tools = response.tools;
      console.log(
        `[MCPSession] Discovered ${this._tools.length} tools:`,
        this._tools.map((t) => t.name).join(', ')
      );
    } catch (error) {
      console.error(`[MCPSession] Failed to discover tools:`, error);
      throw error;
    }
  }

  /**
   * Execute a tool on the server
   */
  async executeTool(toolName: string, args?: Record<string, unknown>): Promise<ToolExecutionResult> {
    if (this._status !== ServerStatus.CONNECTED) {
      return {
        success: false,
        error: 'Server not connected',
      };
    }

    try {
      console.log(`[MCPSession] Executing tool: ${toolName}`, args);
      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      return {
        success: !result.isError,
        content: result.content,
      };
    } catch (error) {
      console.error(`[MCPSession] Tool execution failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    try {
      if (this.transport) {
        await this.client.close();
        this.transport = null;
      }
      this._status = ServerStatus.DISCONNECTED;
      console.log(`[MCPSession] Disconnected from ${this._config.name}`);
    } catch (error) {
      console.error(`[MCPSession] Error during disconnect:`, error);
      throw error;
    }
  }

  /**
   * Check if the session is connected
   */
  isConnected(): boolean {
    return this._status === ServerStatus.CONNECTED;
  }
}
