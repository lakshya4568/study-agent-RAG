import path from "node:path";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";
import { HumanMessage } from "@langchain/core/messages";
import { createStudyMentorGraph } from "./graph";
import { loadStudyMCPTools, type LoadedStudyTools } from "../tools/mcp-loader";
import { logger } from "../client/logger";
import type { BaseMessage } from "@langchain/core/messages";
import type { StudyAgentStateType } from "./state";
import type {
  AgentDocumentAddResult,
  AgentMessageDTO,
  AgentInvocationResult,
  AgentStatus,
} from "./types";
import { ragClient } from "../rag/rag-client";

// Re-export types for convenience
export type { AgentMessageDTO, AgentInvocationResult, AgentStatus };

dotenv.config();

interface StudyAgentOptions {
  documentPaths?: string[];
}

type StudyAgentGraph = Awaited<ReturnType<typeof createStudyMentorGraph>>;

export class StudyAgentService {
  private graph?: StudyAgentGraph;
  private mcpTools?: LoadedStudyTools;
  private initPromise?: Promise<void>;
  private options: StudyAgentOptions = {};
  private currentDocumentPaths: string[] = [];
  private loadedDocumentCount = 0;
  private ragServiceConnected = false;
  private lastInvocationLatencyMs?: number;
  private lastInitDurationMs?: number;
  private lastInitError?: string;

  constructor(options: StudyAgentOptions = {}) {
    this.options = { ...options };
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.setup().catch((error) => {
      this.initPromise = undefined;
      throw error;
    });
    return this.initPromise;
  }

  private async setup(): Promise<void> {
    const initStart = performance.now();
    try {
      logger.info(
        "StudyAgentService setup: checking RAG service connection..."
      );

      // Test RAG service connection
      try {
        const health = await ragClient.healthCheck();
        this.ragServiceConnected = true;
        logger.info("RAG service connected:", {
          collection: health.collection_name,
          embedModel: health.embedding_model,
          llmModel: health.llm_model,
        });

        // Get current document count
        const stats = await ragClient.getCollectionStats();
        this.loadedDocumentCount = stats.document_count;
        logger.info(`RAG collection has ${this.loadedDocumentCount} documents`);
      } catch (error) {
        logger.error("RAG service not available:", error);
        this.ragServiceConnected = false;
        throw new Error("RAG service is not running or not accessible");
      }

      // Load initial documents if specified
      this.currentDocumentPaths = this.resolveDocumentList();
      if (this.currentDocumentPaths.length > 0) {
        logger.info(
          `Loading ${this.currentDocumentPaths.length} documents into RAG...`
        );
        await this.loadDocumentsToRAG(this.currentDocumentPaths);
      }

      logger.info("StudyAgentService setup: loading MCP tools");
      try {
        this.mcpTools = await loadStudyMCPTools();
        logger.info("StudyAgentService setup: MCP tools ready");
      } catch (error) {
        logger.warn(
          "StudyAgentService setup: MCP tools unavailable, continuing without them",
          error
        );
        this.mcpTools = undefined;
      }

      logger.info("StudyAgentService setup: building study mentor graph");
      // Graph queries RAG service directly via ragClient
      this.graph = await createStudyMentorGraph(this.mcpTools?.tools ?? []);
      logger.info("Study agent initialized successfully.");
      this.lastInitError = undefined;
    } catch (error) {
      this.lastInitError =
        error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.lastInitDurationMs = performance.now() - initStart;
    }
  }

  private async loadDocumentsToRAG(documentPaths: string[]): Promise<void> {
    const results = await Promise.allSettled(
      documentPaths.map(async (docPath) => {
        try {
          const result = await ragClient.loadDocument(docPath);
          logger.info(`Loaded document: ${docPath} (${result.chunks} chunks)`);
          return result;
        } catch (error) {
          logger.error(`Failed to load document ${docPath}:`, error);
          throw error;
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    logger.info(
      `Successfully loaded ${successful}/${documentPaths.length} documents`
    );

    // Update document count
    const stats = await ragClient.getCollectionStats();
    this.loadedDocumentCount = stats.document_count;
  }

  getStatus(): AgentStatus {
    return {
      initialized: Boolean(this.graph),
      graphReady: Boolean(this.graph),
      vectorStoreReady: this.ragServiceConnected,
      lastInitDurationMs: this.lastInitDurationMs,
      lastInitError: this.lastInitError,
      lastInvocationLatencyMs: this.lastInvocationLatencyMs,
      documents: {
        requested: this.currentDocumentPaths,
        loadedCount: this.loadedDocumentCount,
        fallbackUsed:
          !this.ragServiceConnected || this.loadedDocumentCount === 0,
      },
      mcpTools: {
        enabled: Boolean(this.mcpTools?.tools?.length),
        toolCount: this.mcpTools?.tools.length ?? 0,
        toolNames: this.mcpTools?.tools.map((tool) => tool.name) ?? [],
      },
      environment: {
        nvidiaApiKey: Boolean(process.env.NVIDIA_API_KEY),
        geminiApiKey: Boolean(process.env.GEMINI_API_KEY),
        anthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
      },
      timestamp: Date.now(),
    };
  }

  private resolveDocumentList(): string[] {
    if (this.options.documentPaths?.length) {
      return this.options.documentPaths.map((docPath) =>
        path.isAbsolute(docPath)
          ? docPath
          : path.resolve(process.cwd(), docPath)
      );
    }
    return [];
  }

  async reloadDocuments(documentPaths: string[]): Promise<void> {
    if (this.initPromise) {
      await this.initPromise.catch(() => undefined);
    }

    const cleaned = documentPaths
      .map((docPath) => docPath.trim())
      .filter((docPath) => docPath.length > 0)
      .map((docPath) =>
        path.isAbsolute(docPath)
          ? docPath
          : path.resolve(process.cwd(), docPath)
      );

    this.currentDocumentPaths = cleaned;
    this.options = {
      ...this.options,
      documentPaths: cleaned.length ? cleaned : undefined,
    };

    if (cleaned.length > 0) {
      await this.loadDocumentsToRAG(cleaned);
    }
  }

  async hasDocuments(): Promise<boolean> {
    await this.initialize().catch((error) => {
      logger.warn("Could not confirm document state", error);
    });

    if (!this.ragServiceConnected) {
      return false;
    }

    try {
      const stats = await ragClient.getCollectionStats();
      return stats.document_count > 0;
    } catch {
      return false;
    }
  }

  async addDocuments(documentPaths: string[]): Promise<AgentDocumentAddResult> {
    try {
      await this.initialize();

      if (!this.ragServiceConnected) {
        throw new Error("RAG service not connected");
      }

      logger.info(
        `Adding ${documentPaths.length} new documents to RAG service`
      );

      const resolvedPaths = documentPaths.map((docPath) =>
        path.isAbsolute(docPath)
          ? docPath
          : path.resolve(process.cwd(), docPath)
      );

      const results = await Promise.allSettled(
        resolvedPaths.map(async (docPath) => {
          const result = await ragClient.loadDocument(docPath);
          return { docPath, result };
        })
      );

      const documentStats: AgentDocumentAddResult["documentStats"] = {};
      const errors: string[] = [];
      let addedCount = 0;

      results.forEach((promiseResult, index) => {
        const docPath = resolvedPaths[index];
        if (promiseResult.status === "fulfilled") {
          const { result } = promiseResult.value;
          documentStats[docPath] = {
            absolutePath: docPath,
            documentId: path.basename(docPath),
            origin: "user-uploaded",
            chunkCount: result.chunks,
            droppedChunks: 0,
            duplicateChunks: 0,
          };
          addedCount++;
        } else {
          errors.push(`${docPath}: ${promiseResult.reason}`);
        }
      });

      // Update tracking
      this.currentDocumentPaths.push(
        ...resolvedPaths.filter((p) => documentStats[p])
      );
      const stats = await ragClient.getCollectionStats();
      this.loadedDocumentCount = stats.document_count;

      return {
        success: addedCount > 0,
        addedCount,
        errors,
        documentStats,
      };
    } catch (error) {
      logger.error("Failed to add documents:", error);
      return {
        success: false,
        addedCount: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        documentStats: {},
      };
    }
  }

  async invoke(
    userMessage: string,
    conversationHistory: BaseMessage[] = []
  ): Promise<AgentInvocationResult> {
    const startTime = performance.now();

    try {
      await this.initialize();

      if (!this.graph) {
        throw new Error("Study agent graph not initialized");
      }

      if (!this.ragServiceConnected) {
        throw new Error("RAG service not connected");
      }

      logger.info(`Agent invoke: "${userMessage.substring(0, 100)}..."`);

      const input: StudyAgentStateType = {
        messages: [...conversationHistory, new HumanMessage(userMessage)],
        documents: [],
        currentTopic: "",
      };

      const result = await this.graph.invoke(input);

      const messages = result.messages as BaseMessage[];
      const lastMessage = messages[messages.length - 1];
      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      this.lastInvocationLatencyMs = performance.now() - startTime;
      logger.info(
        `Agent invocation completed in ${this.lastInvocationLatencyMs.toFixed(0)}ms`
      );

      return {
        success: true,
        finalMessage: content,
        messages: messages.map((msg) => ({
          role: msg._getType(),
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
          name:
            "name" in msg
              ? (msg as BaseMessage & { name?: string }).name
              : undefined,
        })),
        latencyMs: this.lastInvocationLatencyMs,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Agent invocation failed:", errorMessage);

      this.lastInvocationLatencyMs = performance.now() - startTime;

      return {
        success: false,
        finalMessage: `I encountered an error: ${errorMessage}`,
        error: errorMessage,
        latencyMs: this.lastInvocationLatencyMs,
      };
    }
  }

  async dispose(): Promise<void> {
    logger.info("Disposing Study Agent Service");
    this.graph = undefined;
    this.mcpTools = undefined;
    this.initPromise = undefined;
    this.ragServiceConnected = false;
    logger.info("Study Agent Service disposed");
  }
}
