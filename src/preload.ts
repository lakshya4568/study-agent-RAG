// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import type {
  MCPServerConfig,
  ServerInfo,
  ToolExecutionResult,
} from "./client/types";

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
});

contextBridge.exposeInMainWorld("studyAgent", {
  sendMessage: (payload: { threadId: string; message: string }) => {
    return ipcRenderer.invoke("agent:sendMessage", payload);
  },
  getStatus: () => {
    return ipcRenderer.invoke("agent:getStatus");
  },
  reloadDocuments: (documentPaths: string[]) => {
    return ipcRenderer.invoke("agent:reloadDocuments", documentPaths);
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
