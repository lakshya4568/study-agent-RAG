/**
 * Type definitions for the Study Agent Service
 * Separated to avoid importing Node.js modules in the renderer process
 */

export interface AgentMessageDTO {
  role: string;
  content: string;
  name?: string;
}

export interface AgentInvocationResult {
  success: boolean;
  finalMessage?: string;
  messages?: AgentMessageDTO[];
  latencyMs?: number;
  error?: string;
}

export interface AgentStatus {
  initialized: boolean;
  graphReady: boolean;
  vectorStoreReady: boolean;
  lastInitDurationMs?: number;
  lastInitError?: string;
  lastInvocationLatencyMs?: number;
  documents: {
    requested: string[];
    loadedCount: number;
    fallbackUsed: boolean;
  };
  mcpTools: {
    enabled: boolean;
    toolCount: number;
    toolNames: string[];
  };
  environment: {
    nvidiaApiKey: boolean;
    geminiApiKey: boolean;
    anthropicApiKey: boolean;
  };
  timestamp: number;
}

export interface DocumentIngestionStats {
  absolutePath: string;
  documentId: string;
  origin: string;
  chunkCount: number;
  droppedChunks: number;
  duplicateChunks: number;
}

export interface AgentDocumentAddResult {
  success: boolean;
  addedCount: number;
  errors: string[];
  documentStats: Record<string, DocumentIngestionStats>;
}
