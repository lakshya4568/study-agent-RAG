import path from "node:path";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";
import { HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { createStudyMentorGraph } from "./graph";
import {
  loadStudyMCPTools,
  type LoadedStudyTools,
  patchMcpTools,
  sanitizeSchema,
  jsonSchemaToZod,
} from "../tools/mcp-loader";
import { MCPClientManager } from "../client/MCPClientManager";
import { loadMcpTools } from "@langchain/mcp-adapters";
import { logger } from "../client/logger";
import { mcpToolService } from "../client";
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

  constructor(
    options: StudyAgentOptions = {},
    private mcpManager?: MCPClientManager
  ) {
    this.options = { ...options };

    // Listen for tool changes if manager is provided
    if (this.mcpManager) {
      this.mcpManager.onToolsChanged(() => {
        logger.info(
          "StudyAgentService: Tools changed, refreshing agent graph..."
        );
        this.refresh().catch((error) => {
          logger.warn("Failed to refresh agent graph on tool change:", error);
        });
      });
    }
  }

  async refresh(): Promise<void> {
    this.initPromise = undefined;
    this.graph = undefined;
    await this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.setup().catch((error) => {
      this.initPromise = undefined;
      // Don't re-throw here to prevent unhandled rejections in background inits
      logger.error("StudyAgentService initialization failed:", error);
      this.lastInitError =
        error instanceof Error ? error.message : String(error);
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
        // Log warning but continue - RAG might be starting up or unavailable
        // The agent can still function with tools, just without RAG context
        logger.warn(
          "RAG service not available during setup (continuing without it):",
          error instanceof Error ? error.message : String(error)
        );
        this.ragServiceConnected = false;
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
      let allTools: any[] = [];

      try {
        this.mcpTools = await loadStudyMCPTools();
        logger.info("StudyAgentService setup: MCP tools ready");

        // Attach serverId for local tools
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.mcpTools.tools.forEach((tool: any) => {
          tool.serverId = "study-tools";
          tool.serverName = "study-tools";
        });

        allTools = [...this.mcpTools.tools];
      } catch (error) {
        logger.warn(
          "StudyAgentService setup: MCP tools unavailable, continuing without them",
          error
        );
        this.mcpTools = undefined;
      }

      // Load tools from MCPClientManager
      if (this.mcpManager) {
        const clients = this.mcpManager.getAllClients();
        for (const { client, serverId } of clients) {
          try {
            const tools = await loadMcpTools(serverId, client);
            logger.info(`Loaded ${tools.length} tools from server ${serverId}`);

            // Sanitize schemas using raw definitions from MCP server
            const serverInfo = this.mcpManager.getServerInfo(serverId);
            if (serverInfo && serverInfo.tools) {
              logger.info(
                `Server ${serverId} has ${serverInfo.tools.length} raw tools available: ${serverInfo.tools.map((t) => t.name).join(", ")}`
              );

              const rawSchemas = new Map(
                serverInfo.tools.map((t) => [t.name, t.inputSchema])
              );

              for (const tool of tools) {
                const rawSchema = rawSchemas.get(tool.name);
                if (rawSchema) {
                  try {
                    logger.info(`Sanitizing schema for tool: ${tool.name}`);
                    const sanitized = sanitizeSchema(rawSchema);
                    // Log if 'not' was present and removed (simple check)
                    if (JSON.stringify(rawSchema).includes('"not":')) {
                      logger.info(
                        `Removed 'not' keyword from schema of tool: ${tool.name}`
                      );
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tool.schema = jsonSchemaToZod(sanitized) as any;
                  } catch (e) {
                    logger.warn(
                      `Failed to sanitize/convert schema for tool ${tool.name}`,
                      e
                    );
                  }
                } else {
                  logger.warn(
                    `Could not find raw schema for tool: ${tool.name} in server info`
                  );
                }
              }
            } else {
              logger.warn(
                `No server info or tools found for server ${serverId}`
              );
            }

            // Patch tools to ensure they have valid Zod schemas
            const patchedTools = patchMcpTools(tools);

            // Attach serverId to tools for approval logic
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            patchedTools.forEach((tool: any) => {
              tool.serverId = serverId;
              tool.serverName = serverId;
            });

            allTools.push(...patchedTools);
          } catch (error) {
            logger.error(`Failed to load tools from server ${serverId}`, error);
          }
        }
      }

      // Wrap tools with approval logic
      if (allTools.length > 0) {
        logger.info("Wrapping tools with approval logic");
        allTools = this.wrapToolsWithApproval(allTools);
      }

      logger.info("StudyAgentService setup: building study mentor graph");
      // Graph queries RAG service directly via ragClient
      this.graph = await createStudyMentorGraph(allTools);
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

  private async ensureRAGConnection(): Promise<boolean> {
    if (this.ragServiceConnected) {
      return true;
    }

    try {
      logger.info("Attempting to reconnect to RAG service...");
      const health = await ragClient.healthCheck();
      this.ragServiceConnected = true;
      logger.info("RAG service reconnected:", {
        collection: health.collection_name,
        embedModel: health.embedding_model,
        llmModel: health.llm_model,
      });

      // Also update stats if we just reconnected
      const stats = await ragClient.getCollectionStats();
      this.loadedDocumentCount = stats.document_count;

      return true;
    } catch (error) {
      logger.warn("RAG service reconnection failed:", error);
      return false;
    }
  }

  async addDocuments(documentPaths: string[]): Promise<AgentDocumentAddResult> {
    try {
      await this.initialize();

      // Try to ensure connection if missing
      if (!this.ragServiceConnected) {
        await this.ensureRAGConnection();
      }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wrapToolsWithApproval(tools: any[]): any[] {
    return tools.map((tool) => {
      const originalInvoke = tool.invoke.bind(tool);
      const toolName = tool.name;
      const toolDescription = tool.description;

      // We need to preserve the tool's properties so LangChain can inspect them
      // Proxy is good for this
      return new Proxy(tool, {
        get(target, prop, receiver) {
          if (prop === "invoke") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return async (input: any, config: any) => {
              const serverId = target.serverId || "unknown";
              const serverName = target.serverName || "unknown";

              logger.info(`Requesting approval for tool: ${toolName}`);

              // Request approval
              const request = await mcpToolService.requestToolExecution(
                toolName,
                serverId,
                serverName,
                input,
                toolDescription
              );

              // Wait for approval
              const { approved, result } = await mcpToolService.waitForApproval(
                request.id
              );

              if (!approved) {
                logger.info(`Tool execution denied: ${toolName}`);
                return "Tool execution denied by user.";
              }

              logger.info(`Tool execution approved: ${toolName}`);

              // If result is provided (e.g. mock result), return it
              if (result !== undefined) {
                return result;
              }

              return originalInvoke(input, config);
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    });
  }

  async invoke(
    userMessage: string,
    conversationHistory: BaseMessage[] = [],
    options?: { threadId?: string }
  ): Promise<AgentInvocationResult> {
    const startTime = performance.now();

    try {
      await this.initialize();

      // Try to ensure connection if missing
      if (!this.ragServiceConnected) {
        await this.ensureRAGConnection();
      }

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
        route: "general",
      };

      const invokeConfig: RunnableConfig | undefined = options?.threadId
        ? { configurable: { thread_id: options.threadId } }
        : undefined;

      const result = await this.graph.invoke(input, invokeConfig);

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
