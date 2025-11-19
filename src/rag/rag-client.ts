/**
 * RAG Client for NVIDIA RAG Service
 *
 * This module provides a TypeScript client for interacting with the Python FastAPI RAG service.
 * The service handles document ingestion, vectorization, and RAG-based querying.
 *
 * Usage:
 *   const client = new RAGClient();
 *   await client.loadDocument('/path/to/document.pdf');
 *   const result = await client.query('What is the main topic?');
 */

import { logger } from "../client/logger";

/**
 * Default base URL for the RAG service
 */
const DEFAULT_BASE_URL = process.env.RAG_PORT
  ? `http://localhost:${process.env.RAG_PORT}`
  : "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes for document loading

export interface DocumentLoadRequest {
  pdf_path: string;
}

export interface DocumentLoadResponse {
  status: string;
  chunks: number;
  message: string;
}

export interface QueryRequest {
  question: string;
  chat_history?: Array<{ role: string; content: string }>;
  top_k?: number;
}

export interface Source {
  content: string;
  metadata: Record<string, unknown>;
}

export interface QueryResponse {
  answer: string;
  sources: Source[];
  chunks_retrieved: number;
}

export interface AgentQueryRequest {
  question: string;
  use_rag?: boolean;
  auto_route?: boolean;
  top_k?: number;
  max_iterations?: number;
  tools?: Array<{
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    serverId: string;
    serverName: string;
  }>;
}

export interface AgentQueryResponse {
  success: boolean;
  answer: string;
  sources?: string[];
  tool_calls?: Array<{
    name: string;
    arguments?: Record<string, unknown>;
  }>;
  error?: string;
}

export interface HealthResponse {
  status: string;
  nvidia_key_set: boolean;
  persist_dir: string;
  collection_name: string;
  embedding_model: string;
  llm_model: string;
}

export interface CollectionStats {
  collection_name: string;
  document_count: number;
  persist_dir: string;
}

export class RAGClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public detail?: string
  ) {
    super(message);
    this.name = "RAGClientError";
  }
}

export class RAGClient {
  private baseURL: string;
  private timeoutMs: number;

  constructor(
    baseURL: string = DEFAULT_BASE_URL,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {
    this.baseURL = baseURL.replace(/\/$/, ""); // Remove trailing slash
    this.timeoutMs = timeoutMs;
  }

  /**
   * Update service base URL (used when the port is assigned dynamically)
   */
  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL.replace(/\/$/, "");
    logger.info(`RAG client base URL set to ${this.baseURL}`);
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Check if the RAG service is healthy and ready
   */
  async healthCheck(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000), // 5 second timeout for health check
      });

      if (!response.ok) {
        throw new RAGClientError(
          `Health check failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof RAGClientError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error(`RAG health check failed: ${message}`);
      throw new RAGClientError(`Failed to connect to RAG service: ${message}`);
    }
  }

  /**
   * Load and vectorize a PDF document
   *
   * @param pdfPath - Absolute or relative path to the PDF file
   * @returns Document load result with chunk count
   */
  async loadDocument(pdfPath: string): Promise<DocumentLoadResponse> {
    try {
      logger.info(`Loading document into RAG: ${pdfPath}`);

      const request: DocumentLoadRequest = { pdf_path: pdfPath };

      const response = await fetch(`${this.baseURL}/load-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new RAGClientError(
          `Failed to load document: ${response.status} ${response.statusText}`,
          response.status,
          errorData.detail || "Unknown error"
        );
      }

      const result = await response.json();
      logger.info(`Document loaded successfully: ${result.chunks} chunks`);
      return result;
    } catch (error) {
      if (error instanceof RAGClientError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load document: ${message}`);
      throw new RAGClientError(`Document load error: ${message}`);
    }
  }

  /**
   * Query the RAG pipeline with a question
   *
   * @param question - User's question
   * @param chatHistory - Optional conversation history
   * @param topK - Number of document chunks to retrieve (default: 4)
   * @returns Query response with answer and sources
   */
  async query(
    question: string,
    chatHistory: Array<{ role: string; content: string }> = [],
    topK = 4
  ): Promise<QueryResponse> {
    try {
      if (!question || !question.trim()) {
        throw new RAGClientError("Question cannot be empty");
      }

      logger.info(`Querying RAG: "${question.substring(0, 100)}..."`);

      const request: QueryRequest = {
        question,
        chat_history: chatHistory,
        top_k: topK,
      };

      const response = await fetch(`${this.baseURL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(60000), // 60 second timeout for queries
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new RAGClientError(
          `Query failed: ${response.status} ${response.statusText}`,
          response.status,
          errorData.detail || "Unknown error"
        );
      }

      const result = await response.json();
      logger.info(
        `Query successful: ${result.chunks_retrieved} chunks retrieved`
      );
      return result;
    } catch (error) {
      if (error instanceof RAGClientError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Query error: ${message}`);
      throw new RAGClientError(`Query failed: ${message}`);
    }
  }

  /**
   * Clear all documents from the collection
   */
  async clearCollection(): Promise<{ status: string; message: string }> {
    try {
      logger.info("Clearing RAG collection");

      const response = await fetch(`${this.baseURL}/collection`, {
        method: "DELETE",
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new RAGClientError(
          `Failed to clear collection: ${response.status} ${response.statusText}`,
          response.status,
          errorData.detail || "Unknown error"
        );
      }

      const result = await response.json();
      logger.info("Collection cleared successfully");
      return result;
    } catch (error) {
      if (error instanceof RAGClientError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to clear collection: ${message}`);
      throw new RAGClientError(`Clear collection error: ${message}`);
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<CollectionStats> {
    try {
      const response = await fetch(`${this.baseURL}/collection/stats`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new RAGClientError(
          `Failed to get stats: ${response.status} ${response.statusText}`,
          response.status,
          errorData.detail || "Unknown error"
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof RAGClientError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get collection stats: ${message}`);
      throw new RAGClientError(`Stats error: ${message}`);
    }
  }

  /**
   * Test connection to RAG service
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Query the agent endpoint with tool support
   */
  async queryAgent(
    question: string,
    tools?: Array<{
      name: string;
      description: string;
      inputSchema?: Record<string, unknown>;
      serverId: string;
      serverName: string;
    }>,
    options: {
      use_rag?: boolean;
      auto_route?: boolean;
      top_k?: number;
      max_iterations?: number;
    } = {}
  ): Promise<AgentQueryResponse> {
    try {
      const payload: AgentQueryRequest = {
        question,
        tools,
        ...options,
      };

      const response = await fetch(`${this.baseURL}/query-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000), // Increased timeout for agent queries
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          answer: "Failed to process agent query",
          error: errorData.detail || `HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        answer: result.answer,
        sources: result.sources,
        tool_calls: result.tool_calls,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Agent query failed: ${message}`);
      return {
        success: false,
        answer: "An error occurred while processing your request",
        error: message,
      };
    }
  }
}

// Export singleton instance
export const ragClient = new RAGClient();
