/**
 * Type definitions for the window object with exposed APIs
 */

import type {
  MCPServerConfig,
  ServerInfo,
  ToolExecutionResult,
} from "./client/types";
import type { AgentInvocationResult } from "./agent/StudyAgentService";

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
    };
  }
}

export {};
