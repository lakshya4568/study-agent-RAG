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
        config: MCPServerConfig,
      ) => Promise<{ success: boolean; error?: string }>;
      removeServer: (
        serverId: string,
      ) => Promise<{ success: boolean; error?: string }>;
      getServerInfo: (serverId: string) => Promise<ServerInfo | undefined>;
      getAllServers: () => Promise<ServerInfo[]>;
      getAllTools: () => Promise<
        Array<{ name: string; description?: string; serverId: string }>
      >;
      executeTool: (
        serverId: string,
        toolName: string,
        args?: Record<string, unknown>,
      ) => Promise<ToolExecutionResult>;
      findToolServer: (toolName: string) => Promise<string | undefined>;
      getConnectedCount: () => Promise<number>;
      requestToolExecution: (
        toolName: string,
        serverId: string,
        serverName: string,
        args?: Record<string, unknown>,
        description?: string,
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
        id: string,
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
        documentPaths: string[],
      ) => Promise<AgentDocumentAddResult>;
      openFileDialog: () => Promise<{
        success: boolean;
        filePaths: string[];
      }>;
    };
    appConfig: {
      getSummary: () => Promise<ConfigSummaryItem[]>;
      update: (
        values: Record<string, string | undefined>,
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
        userId: string,
      ) => Promise<{ success: boolean; error?: string }>;
      updateThreadTitle: (
        id: string,
        title: string,
      ) => Promise<{ success: boolean; error?: string }>;
      deleteThread: (
        id: string,
      ) => Promise<{ success: boolean; error?: string }>;
      getMessages: (threadId: string) => Promise<{
        success: boolean;
        messages?: ChatMessage[];
        error?: string;
      }>;
      saveMessage: (
        message: ChatMessage,
      ) => Promise<{ success: boolean; error?: string }>;
      clearMessages: (
        threadId: string,
      ) => Promise<{ success: boolean; error?: string }>;
      saveFlashcard: (
        flashcard: Flashcard,
      ) => Promise<{ success: boolean; error?: string }>;
      getFlashcardsByMessageId: (messageId: string) => Promise<{
        success: boolean;
        flashcards?: Flashcard[];
        error?: string;
      }>;
      updateFlashcardStatus: (
        id: string,
        isMastered: boolean,
      ) => Promise<{ success: boolean; error?: string }>;
      getAllDocuments: () => Promise<
        Array<{
          id: string;
          name: string;
          path: string;
          type: string;
          size: number;
          uploadedAt: number;
          status?: "processing" | "ready" | "error";
          chunkCount?: number;
          error?: string;
        }>
      >;
      deleteDocument: (
        id: string,
      ) => Promise<{ success: boolean; error?: string }>;
      getStats: () => Promise<{
        threads: number;
        messages: number;
        documents: number;
        dbSizeMB: number;
      }>;
    };
    fs: {
      readFile: (
        path: string,
      ) => Promise<{ success: boolean; content?: string; error?: string }>;
    };
    ragDashboard: {
      getHealth: () => Promise<{
        status: string;
        nvidia_key_set: boolean;
        embedding_model: string;
        reranking_model?: string;
        llm_model: string;
        hybrid_search?: boolean;
        reranking_enabled?: boolean;
        chunk_size_tokens: number;
        chunk_overlap_tokens: number;
      }>;
      getCollectionStats: () => Promise<{
        collection_name: string;
        total_documents: number;
        document_count: number;
        hybrid_search: boolean;
        persist_dir: string;
      }>;
      getPipelineStats: () => Promise<{
        embedder: {
          model: string;
          total_requests: number;
          total_tokens_embedded: number;
          dimensions: number;
        };
        retriever: {
          collection_name: string;
          total_documents: number;
          document_count: number;
          hybrid_search: boolean;
          persist_dir: string;
        };
        reranker: {
          model: string;
          total_reranked: number;
          avg_input_docs?: number;
        };
        generator: {
          model: string;
          total_generations: number;
        };
        metrics: Record<string, unknown>;
      }>;
      clearCollection: () => Promise<{ status: string; message: string }>;
      getVectorStoreState: () => Promise<{
        totalDocuments: number;
        totalChunks: number;
      } | null>;
    };
  }
}

export {};
