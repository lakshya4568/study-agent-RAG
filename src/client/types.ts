/* eslint-disable import/no-unresolved */
/**
 * Type definitions for MCP Client
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

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
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error",
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
 * Configuration summary item for display
 */
export interface ConfigSummaryItem {
  key: string;
  value?: string;
  maskedValue?: string;
  isSecret: boolean;
  isSet: boolean;
  description?: string;
}

/**
 * Interface for Configuration Manager
 */
export interface IConfigManager {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  getAll(): Record<string, unknown>;
  getSummary(): ConfigSummaryItem[];
}

export interface User {
  id: string;
  email: string;
  username: string;
  password_hash?: string; // In a real app, never return this to client
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  threadId: string;
  metadata?: Record<string, unknown>;
}

export interface UploadedDocument {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  uploadedAt: number;
  status?: "processing" | "ready" | "error";
  chunkCount?: number;
  error?: string;
}

export interface Thread {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  userId?: string;
}

export type ConversationThread = Thread;

export interface Flashcard {
  id: string;
  set_id: string;
  question: string;
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  is_mastered: boolean;
  created_at: number;
  message_id: string;
}
