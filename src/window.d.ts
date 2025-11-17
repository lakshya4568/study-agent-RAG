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
import type { AgentDocumentAddResult } from "./agent/types";
import type {
  ChatMessage,
  UploadedDocument,
  ConversationThread,
} from "./client/DatabaseManager";

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
      addDocuments: (
        documentPaths: string[]
      ) => Promise<AgentDocumentAddResult>;
      openFileDialog: () => Promise<{
        success: boolean;
        filePaths: string[];
      }>;
    };
    appConfig: {
      getSummary: () => Promise<ConfigSummaryItem[]>;
      update: (
        values: Record<string, string | undefined>
      ) => Promise<ConfigSummaryItem[]>;
    };
    database: {
      saveMessage: (
        message: ChatMessage
      ) => Promise<{ success: boolean; error?: string }>;
      getMessages: (threadId: string, limit?: number) => Promise<ChatMessage[]>;
      clearMessages: (
        threadId: string
      ) => Promise<{ success: boolean; error?: string }>;
      createThread: (
        id: string,
        title: string
      ) => Promise<{ success: boolean; error?: string }>;
      getAllThreads: () => Promise<ConversationThread[]>;
      getAllDocuments: () => Promise<UploadedDocument[]>;
      deleteDocument: (
        id: string
      ) => Promise<{ success: boolean; error?: string }>;
      getStats: () => Promise<{
        threads: number;
        messages: number;
        documents: number;
        dbSizeMB: number;
      }>;
    };
  }
}

export {};
