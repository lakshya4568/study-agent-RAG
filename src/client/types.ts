/* eslint-disable import/no-unresolved */
/**
 * Type definitions for MCP Client
 */

import { Tool } from '@modelcontextprotocol/sdk/types';

/**
 * Configuration for connecting to an MCP server
 */
export interface MCPServerConfig {
  /** Unique identifier for this server */
  id: string;
  /** Human-readable name */
  name: string;
  /** Command to execute (e.g., 'node', 'python', 'python3') */
  command: string;
  /** Arguments for the command (e.g., ['path/to/server.js']) */
  args: string[];
  /** Optional environment variables */
  env?: Record<string, string>;
}

/**
 * Status of an MCP server connection
 */
export enum ServerStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * Information about a connected MCP server
 */
export interface ServerInfo {
  config: MCPServerConfig;
  status: ServerStatus;
  tools: Tool[];
  error?: string;
}

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
  success: boolean;
  content?: unknown;
  error?: string;
}

/**
 * Configuration manager interface
 */
export interface IConfigManager {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  getAll(): Record<string, unknown>;
}
