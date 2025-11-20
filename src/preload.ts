// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import type {
  MCPServerConfig,
  ServerInfo,
  ToolExecutionResult,
} from "./client/types";
import type { ChatMessage } from "./client/DatabaseManager";

// Expose MCP Client APIs to the renderer process
contextBridge.exposeInMainWorld("mcpClient", {
  /**
   * Add and connect to a new MCP server
   */
  addServer: (
    config: MCPServerConfig
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke("mcp:addServer", config);
  },

  /**
   * Remove a server connection
   */
  removeServer: (
    serverId: string
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke("mcp:removeServer", serverId);
  },

  /**
   * Get information about a specific server
   */
  getServerInfo: (serverId: string): Promise<ServerInfo | undefined> => {
    return ipcRenderer.invoke("mcp:getServerInfo", serverId);
  },

  /**
   * Get information about all servers
   */
  getAllServers: (): Promise<ServerInfo[]> => {
    return ipcRenderer.invoke("mcp:getAllServers");
  },

  /**
   * Get all available tools from all connected servers
   */
  getAllTools: () => {
    return ipcRenderer.invoke("mcp:getAllTools");
  },

  /**
   * Execute a tool on a specific server
   */
  executeTool: (
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<ToolExecutionResult> => {
    return ipcRenderer.invoke("mcp:executeTool", serverId, toolName, args);
  },

  /**
   * Find which server has a specific tool
   */
  findToolServer: (toolName: string): Promise<string | undefined> => {
    return ipcRenderer.invoke("mcp:findToolServer", toolName);
  },

  /**
   * Get the count of connected servers
   */
  getConnectedCount: (): Promise<number> => {
    return ipcRenderer.invoke("mcp:getConnectedCount");
  },

  /**
   * Request tool execution with approval flow
   */
  requestToolExecution: (
    toolName: string,
    serverId: string,
    serverName: string,
    args?: Record<string, unknown>,
    description?: string
  ): Promise<{ requestId: string }> => {
    return ipcRenderer.invoke("mcp:requestToolExecution", {
      toolName,
      serverId,
      serverName,
      args,
      description,
    });
  },

  /**
   * Approve a tool execution request
   */
  approveToolExecution: (requestId: string): Promise<void> => {
    return ipcRenderer.invoke("mcp:approveToolExecution", requestId);
  },

  /**
   * Deny a tool execution request
   */
  denyToolExecution: (requestId: string): Promise<void> => {
    return ipcRenderer.invoke("mcp:denyToolExecution", requestId);
  },

  /**
   * Get pending tool execution requests
   */
  getPendingToolRequests: (): Promise<unknown[]> => {
    return ipcRenderer.invoke("mcp:getPendingToolRequests");
  },
});

contextBridge.exposeInMainWorld("auth", {
  register: (data: { email: string; password: string; username?: string }) =>
    ipcRenderer.invoke("auth:register", data),
  login: (data: { email: string; password: string }) =>
    ipcRenderer.invoke("auth:login", data),
  getUser: (id: number) => ipcRenderer.invoke("auth:get-user", { id }),
});

contextBridge.exposeInMainWorld("studyAgent", {
  sendMessage: (payload: {
    threadId: string;
    message: string;
    messageId?: string;
  }) => {
    return ipcRenderer.invoke("agent:sendMessage", payload);
  },
  getStatus: () => {
    return ipcRenderer.invoke("agent:getStatus");
  },
  reloadDocuments: (documentPaths: string[]) => {
    return ipcRenderer.invoke("agent:reloadDocuments", documentPaths);
  },
  addDocuments: (documentPaths: string[]) => {
    return ipcRenderer.invoke("agent:addDocuments", documentPaths);
  },
  openFileDialog: () => {
    return ipcRenderer.invoke("agent:openFileDialog");
  },
});

contextBridge.exposeInMainWorld("appConfig", {
  getSummary: () => {
    return ipcRenderer.invoke("config:getSummary");
  },
  update: (values: Record<string, string | undefined>) => {
    return ipcRenderer.invoke("config:update", values);
  },
});

contextBridge.exposeInMainWorld("db", {
  getThreads: (userId: number) =>
    ipcRenderer.invoke("db:get-threads", { userId }),
  createThread: (id: string, title: string, userId: number) =>
    ipcRenderer.invoke("db:create-thread", { id, title, userId }),
  deleteThread: (id: string) => ipcRenderer.invoke("db:delete-thread", { id }),
  getMessages: (threadId: string) =>
    ipcRenderer.invoke("db:get-messages", { threadId }),
  saveMessage: (message: ChatMessage) =>
    ipcRenderer.invoke("db:save-message", { message }),
  clearMessages: (threadId: string) =>
    ipcRenderer.invoke("db:clear-messages", { threadId }),
});
