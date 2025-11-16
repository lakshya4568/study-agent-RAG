import path from "node:path";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";
import { HumanMessage } from "@langchain/core/messages";
import type { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStudyMentorGraph } from "./graph";
import { loadStudyDocuments } from "../rag/document-loader";
import { createStudyMaterialVectorStore } from "../rag/vector-store";
import { loadStudyMCPTools, type LoadedStudyTools } from "../tools/mcp-loader";
import { logger } from "../client/logger";
import type { BaseMessage } from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";
import type { StudyAgentStateType } from "./state";

dotenv.config();

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
  private vectorStore?: MemoryVectorStore;
  private mcpTools?: LoadedStudyTools;
  private initPromise?: Promise<void>;

  constructor(private readonly options: StudyAgentOptions = {}) {}

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.setup();
    return this.initPromise;
  }

  private async setup(): Promise<void> {
    const docs = await loadStudyDocuments(this.resolveDocumentList());

    if (docs.length === 0) {
      docs.push(
        new Document({
          pageContent:
            "Study Agent fallback context. Add documents to the repository (README, component docs) for richer answers.",
        })
      );
    }

    this.vectorStore = await createStudyMaterialVectorStore(docs);
    this.mcpTools = await loadStudyMCPTools();
    this.graph = await createStudyMentorGraph(
      this.vectorStore,
      this.mcpTools.tools
    );
    logger.info("Study agent initialized successfully.");
  }

  private resolveDocumentList(): string[] {
    if (this.options.documentPaths?.length) {
      return this.options.documentPaths;
    }
    return DEFAULT_DOCS.map((doc) => path.resolve(process.cwd(), doc));
  }

  async sendMessage(
    message: string,
    threadId: string
  ): Promise<AgentInvocationResult> {
    const start = performance.now();
    try {
      await this.initialize();
      if (!this.graph) {
        throw new Error("Study agent graph not ready");
      }

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

      const messages = response.messages || [];
      const finalMessage = messages[messages.length - 1];
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
  }
}
