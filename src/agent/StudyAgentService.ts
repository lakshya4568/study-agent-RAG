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

// Re-export types for convenience
export type { AgentMessageDTO, AgentInvocationResult, AgentStatus };

dotenv.config();

interface StudyAgentOptions {
  documentPaths?: string[];
}

const DEFAULT_DOCS = [
  "README.md",
  "COMPONENT_USAGE_GUIDE.md",
  "LAYOUT_FIX_SUMMARY.md",
  "UI_REORGANIZATION_SUMMARY.md",
];

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
    return DEFAULT_DOCS.map((doc) => path.resolve(process.cwd(), doc));
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

      await this.vectorStore.addDocuments(chunks);

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
