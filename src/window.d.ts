/**
 * Type definitions for the window object with exposed APIs
 */

import type {
  MCPServerConfig,
  ServerInfo,
  ToolExecutionResult,
  ConfigSummaryItem,
  ChatMessage,
  ConversationThread,
  User,
  Flashcard,
} from "./client/types";
import type {
  AgentInvocationResult,
  AgentStatus,
} from "./agent/StudyAgentService";
import type { AgentDocumentAddResult } from "./agent/types";

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
      requestToolExecution: (
        toolName: string,
        serverId: string,
        serverName: string,
        args?: Record<string, unknown>,
        description?: string
      ) => Promise<{ requestId: string }>;
      approveToolExecution: (requestId: string) => Promise<void>;
      denyToolExecution: (requestId: string) => Promise<void>;
      getPendingToolRequests: () => Promise<unknown[]>;
    };
    auth: {
      register: (data: {
        email: string;
        password: string;
        username?: string;
      }) => Promise<{ success: boolean; user?: User; error?: string }>;
      login: (data: {
        email: string;
        password: string;
      }) => Promise<{ success: boolean; user?: User; error?: string }>;
      getUser: (
        id: string
      ) => Promise<{ success: boolean; user?: User; error?: string }>;
    };
    studyAgent: {
      sendMessage: (payload: {
        threadId: string;
        message: string;
        messageId?: string;
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
    db: {
      getThreads: (userId: string) => Promise<{
        success: boolean;
        threads?: ConversationThread[];
        error?: string;
      }>;
      createThread: (
        id: string,
        title: string,
        userId: string
      ) => Promise<{ success: boolean; error?: string }>;
      updateThreadTitle: (
        id: string,
        title: string
      ) => Promise<{ success: boolean; error?: string }>;
      deleteThread: (
        id: string
      ) => Promise<{ success: boolean; error?: string }>;
      getMessages: (threadId: string) => Promise<{
        success: boolean;
        messages?: ChatMessage[];
        error?: string;
      }>;
      saveMessage: (
        message: ChatMessage
      ) => Promise<{ success: boolean; error?: string }>;
      clearMessages: (
        threadId: string
      ) => Promise<{ success: boolean; error?: string }>;
      saveFlashcard: (
        flashcard: Flashcard
      ) => Promise<{ success: boolean; error?: string }>;
      getFlashcardsByMessageId: (messageId: string) => Promise<{
        success: boolean;
        flashcards?: Flashcard[];
        error?: string;
      }>;
      updateFlashcardStatus: (
        id: string,
        isMastered: boolean
      ) => Promise<{ success: boolean; error?: string }>;
    };
    fs: {
      readFile: (
        path: string
      ) => Promise<{ success: boolean; content?: string; error?: string }>;
    };
  }
}

export {};
