/**
 * Type definitions for the window object with exposed APIs
 */

import type {
  MCPServerConfig,
  ServerInfo,
  ToolExecutionResult,
  ConfigSummaryItem,
} from "./client/types";
import type {
  AgentInvocationResult,
  AgentStatus,
} from "./agent/StudyAgentService";

declare global {
  interface Window {
    mcpClient: {
      addServer: (
        config: MCPServerConfig
      ) => Promise<{ success: boolean; error?: string }>;
      removeServer: (
        serverId: string
      ) => Promise<{ success: boolean; error?: string }>;
      getServerInfo: (serverId: string) => Promise<ServerInfo | undefined>;
      getAllServers: () => Promise<ServerInfo[]>;
      getAllTools: () => Promise<
        Array<{ name: string; description?: string; serverId: string }>
      >;
      executeTool: (
        serverId: string,
        toolName: string,
        args?: Record<string, unknown>
      ) => Promise<ToolExecutionResult>;
      findToolServer: (toolName: string) => Promise<string | undefined>;
      getConnectedCount: () => Promise<number>;
    };
    studyAgent: {
      sendMessage: (payload: {
        threadId: string;
        message: string;
      }) => Promise<AgentInvocationResult>;
      getStatus: () => Promise<AgentStatus>;
      reloadDocuments: (documentPaths: string[]) => Promise<AgentStatus>;
      addDocuments: (documentPaths: string[]) => Promise<{
        success: boolean;
        addedCount: number;
        errors: string[];
      }>;
    };
    appConfig: {
      getSummary: () => Promise<ConfigSummaryItem[]>;
      update: (
        values: Record<string, string | undefined>
      ) => Promise<ConfigSummaryItem[]>;
    };
  }
}

export {};
