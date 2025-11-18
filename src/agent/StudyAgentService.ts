import path from "node:path";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";
import { HumanMessage } from "@langchain/core/messages";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { createStudyMentorGraph } from "./graph";
import { loadStudyDocuments } from "../rag/document-loader";
import {
  createStudyMaterialVectorStore,
  chunkDocumentsForVectorStore,
} from "../rag/vector-store";
import { loadStudyMCPTools, type LoadedStudyTools } from "../tools/mcp-loader";
import { logger } from "../client/logger";
import type { BaseMessage } from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";
import type { StudyAgentStateType } from "./state";
import type {
  AgentDocumentAddResult,
  AgentMessageDTO,
  AgentInvocationResult,
  AgentStatus,
} from "./types";

/**
 * Sanitizes metadata to only include primitive types (string, number, boolean, null)
 * ChromaDB does not support nested objects or arrays in metadata
 */
function sanitizeMetadata(
  metadata: Record<string, any>
): Record<string, string | number | boolean | null> {
  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    } else if (typeof value === "object") {
      // Convert objects/arrays to JSON strings
      sanitized[key] = JSON.stringify(value);
    } else {
      // Convert any other type to string
      sanitized[key] = String(value);
    }
  }

  return sanitized;
}

// Re-export types for convenience
export type { AgentMessageDTO, AgentInvocationResult, AgentStatus };

dotenv.config();

interface StudyAgentOptions {
  documentPaths?: string[];
}

// No default documents - agent starts with empty knowledge base
// Documents should be uploaded via UI or addDocuments() method

type StudyAgentGraph = Awaited<ReturnType<typeof createStudyMentorGraph>>;

export class StudyAgentService {
  private graph?: StudyAgentGraph;
  private vectorStore?: Chroma;
  private mcpTools?: LoadedStudyTools;
  private initPromise?: Promise<void>;
  private options: StudyAgentOptions = {};
  private currentDocumentPaths: string[] = [];
  private loadedDocumentCount = 0;
  private fallbackContextUsed = false;
  private forcedPlaceholderRemoved = false;
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
      logger.info("StudyAgentService setup: loading study documents...");
      this.currentDocumentPaths = this.resolveDocumentList();
      const docs = await loadStudyDocuments(this.currentDocumentPaths);
      logger.info(`StudyAgentService setup: loaded ${docs.length} documents`);

      let fallbackInjected = false;
      if (docs.length === 0) {
        docs.push(
          new Document({
            pageContent:
              "Study Agent fallback context. Add documents to the repository (README, component docs) for richer answers.",
          })
        );
        logger.warn(
          "StudyAgentService setup: no documents found, using fallback context"
        );
        fallbackInjected = true;
      }

      this.loadedDocumentCount = docs.length;
      this.fallbackContextUsed = fallbackInjected;
      this.forcedPlaceholderRemoved = false;

      logger.info("StudyAgentService setup: creating vector store");
      this.vectorStore = await createStudyMaterialVectorStore(docs);
      logger.info("StudyAgentService setup: vector store ready");

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
      this.graph = await createStudyMentorGraph(
        this.vectorStore,
        this.mcpTools?.tools ?? []
      );
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

  getStatus(): AgentStatus {
    return {
      initialized: Boolean(this.graph),
      graphReady: Boolean(this.graph),
      vectorStoreReady: Boolean(this.vectorStore),
      lastInitDurationMs: this.lastInitDurationMs,
      lastInitError: this.lastInitError,
      lastInvocationLatencyMs: this.lastInvocationLatencyMs,
      documents: {
        requested: this.currentDocumentPaths,
        loadedCount: this.loadedDocumentCount,
        fallbackUsed: this.fallbackContextUsed,
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
    // Return empty array - agent starts with no documents
    return [];
  }

  async reloadDocuments(documentPaths: string[]): Promise<void> {
    if (this.initPromise) {
      await this.initPromise.catch(() => undefined);
    }
    await this.dispose();
    const cleaned = documentPaths
      .map((docPath) => docPath.trim())
      .filter((docPath) => docPath.length > 0)
      .map((docPath) =>
        path.isAbsolute(docPath)
          ? docPath
          : path.resolve(process.cwd(), docPath)
      );
    this.options = {
      ...this.options,
      documentPaths: cleaned.length ? cleaned : undefined,
    };
    await this.initialize();
  }

  /**
   * Add new documents to the vector store without full reinitialization
   */
  /**
   * Check if the vector store has any documents
   */
  async hasDocuments(): Promise<boolean> {
    await this.initialize().catch((error) => {
      logger.warn("Could not confirm document state", error);
    });
    return !this.fallbackContextUsed && this.loadedDocumentCount > 0;
  }

  async removeDocumentsByPaths(documentPaths: string[]): Promise<void> {
    if (!documentPaths.length) {
      return;
    }

    await this.initialize().catch((error) => {
      logger.warn("Failed to initialize before removing documents", error);
    });

    if (!this.vectorStore) {
      return;
    }

    const normalizedPaths = documentPaths.map((docPath) =>
      path.isAbsolute(docPath)
        ? path.resolve(docPath)
        : path.resolve(process.cwd(), docPath)
    );

    const uniquePaths = Array.from(new Set(normalizedPaths));

    await Promise.all(
      uniquePaths.map(async (docPath) => {
        try {
          await this.vectorStore?.delete({
            filter: { absolutePath: docPath },
          });
          logger.info(`Removed existing embeddings for ${docPath}`);
        } catch (error) {
          logger.warn(
            `Failed to remove embeddings for ${docPath}: ${String(error)}`
          );
        }
      })
    );

    const removalSet = new Set(uniquePaths);
    this.currentDocumentPaths = this.currentDocumentPaths.filter(
      (docPath) => !removalSet.has(path.resolve(docPath))
    );
    if (!this.fallbackContextUsed) {
      this.loadedDocumentCount = Math.max(
        0,
        this.loadedDocumentCount - removalSet.size
      );
    }
  }

  async addDocuments(documentPaths: string[]): Promise<AgentDocumentAddResult> {
    try {
      await this.initialize();

      if (!this.vectorStore) {
        throw new Error("Vector store not initialized");
      }

      logger.info(
        `Adding ${documentPaths.length} new documents to vector store`
      );
      const resolvedPaths = documentPaths.map((docPath) =>
        path.isAbsolute(docPath)
          ? docPath
          : path.resolve(process.cwd(), docPath)
      );

      const newDocs = await loadStudyDocuments(resolvedPaths);

      if (newDocs.length === 0) {
        return {
          success: false,
          addedCount: 0,
          errors: ["No valid documents could be loaded"],
          documentStats: {},
        };
      }

      const { chunks, summary } = await chunkDocumentsForVectorStore(newDocs);

      const documentStats: AgentDocumentAddResult["documentStats"] = {};
      const skippedDocuments: string[] = [];

      Object.values(summary.perDocument).forEach((stats) => {
        const normalizedPath = path.resolve(stats.absolutePath);
        if (stats.keptChunks === 0) {
          skippedDocuments.push(normalizedPath);
          return;
        }
        documentStats[normalizedPath] = {
          absolutePath: stats.absolutePath,
          documentId: stats.documentId,
          origin: stats.origin,
          chunkCount: stats.keptChunks,
          droppedChunks: stats.droppedShort,
          duplicateChunks: stats.droppedDuplicates,
        };
      });

      if (Object.keys(documentStats).length === 0) {
        const errorMessage =
          "Uploaded documents did not contain extractable text. Try uploading searchable PDFs or plain text files.";
        logger.warn(
          `Skipping ingestion. Reason: ${errorMessage}. Files without chunks: ${skippedDocuments.join(", ")}`
        );
        return {
          success: false,
          addedCount: 0,
          errors: [errorMessage],
          documentStats: {},
        };
      }

      logger.info(
        `Split ${newDocs.length} documents into ${chunks.length} chunks (raw: ${summary.totalRawChunks}, shortFiltered: ${summary.droppedShort}, duplicates: ${summary.droppedDuplicates})`
      );

      if (skippedDocuments.length) {
        logger.warn(
          `Skipped ${skippedDocuments.length} document(s) with no extractable text`,
          { skippedDocuments }
        );
      }

      if (this.fallbackContextUsed && !this.forcedPlaceholderRemoved) {
        try {
          await this.vectorStore.delete({ filter: { origin: "system" } });
          logger.info("Removed placeholder context after first upload");
        } catch (error) {
          logger.warn("Failed to remove placeholder context", error);
        }
        this.fallbackContextUsed = false;
        this.forcedPlaceholderRemoved = true;
        this.loadedDocumentCount = 0;
      }

      // Sanitize metadata before adding to vector store
      const sanitizedChunks = chunks.map((chunk) => ({
        ...chunk,
        metadata: sanitizeMetadata(chunk.metadata || {}),
      }));

      logger.info(
        `📤 Adding ${sanitizedChunks.length} sanitized chunks to vector store...`
      );
      await this.vectorStore.addDocuments(sanitizedChunks);
      logger.info(`✅ Successfully added chunks to vector store`);

      // Update tracking
      const ingestedPaths = Object.keys(documentStats);
      const ingestedSet = new Set(ingestedPaths.map((p) => path.resolve(p)));
      this.currentDocumentPaths = [
        ...this.currentDocumentPaths,
        ...resolvedPaths.filter((resolved) =>
          ingestedSet.has(path.resolve(resolved))
        ),
      ];
      this.loadedDocumentCount += ingestedPaths.length;

      logger.info(
        `Successfully added ${ingestedPaths.length} documents (${chunks.length} chunks) to vector store`
      );

      return {
        success: true,
        addedCount: ingestedPaths.length,
        errors: skippedDocuments.length
          ? skippedDocuments.map(
              (filePath) =>
                `No text extracted from ${path.basename(filePath)}. Upload a text-based version if possible.`
            )
          : [],
        documentStats,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to add documents: ${errorMsg}`);
      return {
        success: false,
        addedCount: 0,
        errors: [errorMsg],
        documentStats: {},
      };
    }
  }

  async sendMessage(
    message: string,
    threadId: string
  ): Promise<AgentInvocationResult> {
    const start = performance.now();
    try {
      await this.initialize();
      logger.info(
        `StudyAgentService sendMessage: initialized and processing thread ${threadId}`
      );
      if (!this.graph) {
        throw new Error("Study agent graph not ready");
      }

      logger.info(
        `StudyAgentService sendMessage: invoking graph for message: ${message.substring(0, 100)}`
      );
      const response: Partial<StudyAgentStateType> = await this.graph.invoke(
        {
          messages: [new HumanMessage(message)],
          documents: [],
          currentTopic: "",
        },
        {
          configurable: { thread_id: threadId },
        }
      );
      logger.info("StudyAgentService sendMessage: graph invocation completed");

      const messages = response.messages || [];
      const finalMessage = messages[messages.length - 1];
      logger.info(
        `StudyAgentService sendMessage: returning ${messages.length} messages for thread ${threadId}`
      );
      return {
        success: true,
        finalMessage:
          typeof finalMessage?.content === "string"
            ? finalMessage.content
            : JSON.stringify(finalMessage?.content),
        messages: this.serializeMessages(messages),
        latencyMs: performance.now() - start,
      };
    } catch (error) {
      logger.error("Study agent invocation failed", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.lastInvocationLatencyMs = performance.now() - start;
    }
  }

  private serializeMessages(messages: BaseMessage[]): AgentMessageDTO[] {
    return messages.map((message) => {
      const typedMessage = message as BaseMessage & {
        _getType?: () => string;
        name?: string;
      };
      const role =
        typeof typedMessage._getType === "function"
          ? typedMessage._getType()
          : "assistant";
      const content =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content);
      return {
        role,
        content,
        name: typedMessage.name,
      };
    });
  }

  async dispose(): Promise<void> {
    if (this.mcpTools) {
      await this.mcpTools.client.close();
      try {
        await (
          this.mcpTools.transport as unknown as { close?: () => Promise<void> }
        ).close?.();
      } catch (error) {
        logger.warn("Failed to close MCP transport cleanly", error);
      }
      this.mcpTools = undefined;
    }
    this.graph = undefined;
    this.vectorStore = undefined;
    this.initPromise = undefined;
  }
}
