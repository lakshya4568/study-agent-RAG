import { SystemMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import { createNVIDIAOpenAIChat } from "../models/nvidia-openai-chat";
import type { StudyAgentStateType } from "./state";
import { logger } from "../client/logger";
import { ragClient } from "../rag/rag-client";
import { StructuredTool } from "@langchain/core/tools";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { MemoryManager } from "./MemoryManager";
import {
  enrichAllTools,
  toOpenAIToolFormat,
  createToolAwareSystemPrompt,
  validateToolArguments,
  mergeWithDefaults,
} from "../tools/tool-schema-enricher";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const STUDY_MENTOR_SYSTEM_PROMPT = `You are Alex, an enthusiastic and patient AI Study Mentor created with NVIDIA AI technology! 🎓

Your Personality:
- Friendly, warm, and encouraging — like a supportive mentor who makes complex ideas feel accessible
- Genuinely excited about learning and celebrating every breakthrough, big or small
- Patient and non-judgmental — no question is too basic
- Conversational tone with helpful formatting (bullet points, clear headers, concise analogies)

Your Mission as a Study Mentor:
- Guide students to understand core principles rather than just handing out rote answers
- Break down intimidating topics into bite-sized, digestible components (Feynman Technique)
- When answering conceptual questions, explain simply, give examples, and check understanding
- When asked for specific data extraction (e.g., "list questions", "summarize section X"), provide the exact, accurate information directly
- Always stay grounded in the provided study materials when available

TOOL USAGE & ACCURACY:
- When you use tools, ground your reasoning strictly in the tool outputs.
- Explain tool operations clearly and handle any errors gracefully.

When Using Retrieved Context:
- Reference sources as [Source N] when citing study materials
- If information is not in the provided context, state that honestly and offer general educational guidance`;

function formatSourceLabel(doc: Document): string {
  const baseName = doc.metadata?.fileName || doc.metadata?.source || doc.metadata?.source_name || "Study Material";
  const originLabel =
    doc.metadata?.origin === "user-uploaded" ? "User Upload" : "Study Document";
  const pageLabel = doc.metadata?.page !== undefined ? ` · Page ${doc.metadata.page}` : "";
  return `${baseName} (${originLabel}${pageLabel})`;
}

/**
 * Clean and assemble conversation messages for the LLM.
 * Eliminates redundant/stacked system messages and keeps only clean dialog turns.
 */
function assembleContextMessages(
  systemPrompt: string,
  rawMessages: BaseMessage[],
  ragContextMessage?: SystemMessage,
  maxHistoryTurns = 12
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const openAIMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (ragContextMessage) {
    openAIMessages.push({
      role: "system",
      content:
        typeof ragContextMessage.content === "string"
          ? ragContextMessage.content
          : JSON.stringify(ragContextMessage.content),
    });
  }

  // Filter out internal system messages and old RAG injections from history
  const dialogueMessages = rawMessages.filter((msg) => {
    const type = msg._getType?.() ?? (msg as { role?: string }).role;
    if (type === "system") {
      // Exclude synthetic RAG injection messages from history
      const content = String(msg.content || "");
      if (
        content.startsWith("Retrieved Context from Study Materials") ||
        content.startsWith("I couldn't find any matching context") ||
        content.startsWith("Failed to retrieve context")
      ) {
        return false;
      }
    }
    return true;
  });

  // Keep the most recent conversation turns
  const recentDialogue = dialogueMessages.slice(-maxHistoryTurns);

  for (const msg of recentDialogue) {
    const rawType = (msg._getType?.() ?? (msg as { role?: string }).role ?? "") as string;
    const role: "user" | "system" | "assistant" =
      rawType === "human" || rawType === "user"
        ? "user"
        : rawType === "system"
          ? "system"
          : "assistant";

    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);

    openAIMessages.push({ role, content });
  }

  return openAIMessages;
}

/**
 * State-aware router that chooses the optimal execution strategy.
 */
export async function routeNode(
  state: StudyAgentStateType
): Promise<Partial<StudyAgentStateType>> {
  try {
    const lastMessage = state.messages[state.messages.length - 1];
    const query = (
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content)
    ).trim();

    const lowerQuery = query.toLowerCase();

    // Fast-path heuristic detection for explicit memory commands
    if (
      lowerQuery.startsWith("remember ") ||
      lowerQuery.startsWith("save this") ||
      lowerQuery.startsWith("note this") ||
      lowerQuery.includes("what do you remember") ||
      lowerQuery.includes("what do you know about me") ||
      lowerQuery.includes("show my memory") ||
      lowerQuery.includes("show memory") ||
      lowerQuery.startsWith("forget ") ||
      lowerQuery.startsWith("delete memory") ||
      lowerQuery.includes("temporary chat mode") ||
      lowerQuery.includes("temporary mode")
    ) {
      logger.info("[Router] Fast-path detected memory command");
      return { route: "memory" };
    }

    // Fast-path heuristic for explicit flashcard creation
    if (
      lowerQuery.startsWith("create flashcards") ||
      lowerQuery.startsWith("generate flashcards") ||
      lowerQuery.startsWith("make flashcards") ||
      lowerQuery.includes("flashcards for") ||
      lowerQuery.includes("generate study cards")
    ) {
      logger.info("[Router] Fast-path detected flashcard intent");
      return { route: "flashcard" };
    }

    // Check if documents are available in the system
    let hasLoadedDocs = (state.documents?.length ?? 0) > 0;
    if (!hasLoadedDocs) {
      try {
        const stats = await ragClient.getCollectionStats();
        hasLoadedDocs = (stats.document_count ?? 0) > 0;
      } catch {
        hasLoadedDocs = false;
      }
    }

    // LLM-based routing with state awareness
    const model = createNVIDIAOpenAIChat({ temperature: 0.1, maxTokens: 50 });
    const prompt = `You are an intelligent intent router for the AI Study Agent.
Decide the single best route for the user query.

Context:
- Knowledge base has documents loaded: ${hasLoadedDocs ? "YES" : "NO"}
- Previous route: ${state.route || "none"}

Options:
- "memory": User explicitly asks to save, view, or manage long-term personal memories.
- "flashcard": User explicitly asks to create or generate flashcards or quiz cards.
- "rag": User asks about study materials, uploaded documents, summaries of content, concept explanations from documents, or questions to find/extract from knowledge base.
- "tool": User explicitly asks for system tools (convert timezones, calculate, run MCP tool).
- "general": Greetings, casual study advice, or general conversation not requiring document retrieval.

User Query: "${query}"

Return ONLY one word: memory, flashcard, rag, tool, or general.`;

    const response = await model.invoke([{ role: "user", content: prompt }]);
    const route = response.toLowerCase().trim();

    logger.info(`[Router] Decision: ${route}`);

    if (route.includes("memory")) return { route: "memory" };
    if (route.includes("flashcard")) return { route: "flashcard" };
    if (route.includes("rag")) return { route: "rag" };
    if (route.includes("tool")) return { route: "tool" };

    // If documents exist and user asks something study-related, default to RAG for grounding
    if (
      hasLoadedDocs &&
      (lowerQuery.includes("explain") ||
        lowerQuery.includes("summarize") ||
        lowerQuery.includes("what is") ||
        lowerQuery.includes("how does") ||
        lowerQuery.includes("topic") ||
        lowerQuery.includes("chapter") ||
        lowerQuery.includes("notes"))
    ) {
      return { route: "rag" };
    }

    return { route: "general" };
  } catch (error) {
    logger.error("Router failed, defaulting to general", error);
    return { route: "general" };
  }
}

/**
 * Retrieves relevant document chunks from the RAG service.
 */
export async function retrieveNode(
  state: StudyAgentStateType
): Promise<Partial<StudyAgentStateType>> {
  try {
    const lastMessage = state.messages[state.messages.length - 1];
    const query =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    logger.info(
      `[RetrieveNode] Retrieving documents for query: "${query.substring(0, 80)}..."`
    );

    // Extract recent conversational context for multi-turn search
    const recentTurns: Array<{ role: string; content: string }> = state.messages
      .slice(-4, -1)
      .map((m) => ({
        role: m._getType?.() === "human" ? "user" : "assistant",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      }));

    const ragResponse = await ragClient.query(query, recentTurns, 5);
    const docs = ragResponse.sources.map((source) => ({
      pageContent: source.content,
      metadata: {
        fileName: source.metadata.source || source.metadata.source_name || "Study Document",
        source: source.metadata.source || source.metadata.source_name || "Study Document",
        page: source.metadata.page,
        origin: "user-uploaded",
      },
    })) as Document[];

    if (docs.length === 0) {
      logger.warn("[RetrieveNode] No relevant documents found");
      return {
        documents: [],
        messages: [
          new SystemMessage({
            content:
              "I couldn't find specific passages in your study documents for this query. I'll provide an answer based on general knowledge.",
          }),
        ],
      };
    }

    logger.info(`[RetrieveNode] Retrieved ${docs.length} relevant chunks`);

    const contextWithSources = docs
      .map((doc, idx) => {
        const source = formatSourceLabel(doc);
        const content = doc.pageContent.trim();
        return `[Source ${idx + 1}: ${source}]\n${content}`;
      })
      .join("\n\n---\n\n");

    return {
      documents: docs,
      messages: [
        new SystemMessage({
          content: `Retrieved Context from Study Materials:\n\n${contextWithSources}\n\nInstructions:\n- Use the above context to answer the user's question accurately.\n- If the user asks to extract specific items (like questions, terms, dates), list them exactly as they appear in the context.\n- Cite the source (e.g., [Source 1]) for your information.`,
        }),
      ],
    };
  } catch (error) {
    logger.error("[RetrieveNode] Retrieval failed", error);
    return {
      documents: [],
      messages: [
        new SystemMessage({
          content:
            "Note: Document retrieval encountered a temporary error. Providing an answer based on general knowledge.",
        }),
      ],
    };
  }
}

/**
 * Creates the primary synthesis query node.
 */
export function createQueryNode(tools: StructuredTool[]) {
  return async function queryNode(
    state: StudyAgentStateType
  ): Promise<Partial<StudyAgentStateType>> {
    try {
      const model = createNVIDIAOpenAIChat({ temperature: 0.3 });

      const mcpTools: Tool[] = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.schema as Tool["inputSchema"],
      }));

      const enrichedTools = enrichAllTools(mcpTools);
      const openAITools: ChatCompletionTool[] =
        enrichedTools.map(toOpenAIToolFormat);

      const hasRAGContext = (state.documents?.length ?? 0) > 0;

      // Construct system prompt with persona + memory context
      let baseSystemPrompt = STUDY_MENTOR_SYSTEM_PROMPT;
      const memoryCtx = state.memoryContext || "";
      if (memoryCtx) {
        baseSystemPrompt += `\n\n--- Memory Context ---\n${memoryCtx}\n--- End Memory Context ---`;
      }

      // Add tool instructions only when no heavy RAG context is present to keep tokens bounded
      const systemPrompt = hasRAGContext
        ? baseSystemPrompt
        : createToolAwareSystemPrompt(baseSystemPrompt, enrichedTools);

      // Find any RAG context system message from retrieveNode
      const ragMessage = state.messages.find(
        (m) =>
          m._getType?.() === "system" &&
          typeof m.content === "string" &&
          m.content.startsWith("Retrieved Context from Study Materials")
      ) as SystemMessage | undefined;

      // Assemble structured context slots
      const openAIMessages = assembleContextMessages(
        systemPrompt,
        state.messages,
        ragMessage,
        10
      );

      logger.info(
        `[QueryNode] Assembled ${openAIMessages.length} message slots (RAG docs: ${state.documents?.length ?? 0})`
      );

      let responseContent: string;

      if (hasRAGContext) {
        // Direct generation grounded in RAG context
        responseContent = await model.invoke(openAIMessages);
      } else if (openAITools.length > 0) {
        // Tool-aware execution path
        const toolExecutor = async (
          toolName: string,
          args: Record<string, unknown>
        ) => {
          const tool = tools.find((t) => t.name === toolName);
          if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
          }

          const enrichedSchema = enrichedTools.find((t) => t.name === toolName);
          if (enrichedSchema) {
            const validation = validateToolArguments(
              toolName,
              args,
              enrichedSchema
            );
            args = mergeWithDefaults(args, validation.defaults);
          }

          logger.info(`[QueryNode] Executing tool: ${toolName}`, args);
          const result = await tool.invoke(args);
          return typeof result === "string" ? result : JSON.stringify(result);
        };

        const toolResponse = await model.invokeWithTools(
          openAIMessages,
          openAITools,
          toolExecutor
        );
        responseContent = toolResponse.content;
      } else {
        responseContent = await model.invoke(openAIMessages);
      }

      return {
        messages: [new AIMessage({ content: responseContent })],
      };
    } catch (error) {
      logger.error("[QueryNode] Execution failed", error);
      return {
        messages: [
          new AIMessage({
            content:
              "I apologize, but I encountered an error processing your query. Please try again! 😊",
          }),
        ],
      };
    }
  };
}

/**
 * Generates structured flashcards from context or topic.
 */
export async function flashcardNode(
  state: StudyAgentStateType
): Promise<Partial<StudyAgentStateType>> {
  try {
    const model = createNVIDIAOpenAIChat({ temperature: 0.2 });

    const userMessages = state.messages.filter(
      (msg) => msg._getType?.() === "human" || (msg as { role?: string }).role === "user"
    );
    const question = userMessages[userMessages.length - 1]?.content || "Study topic";

    // If documents are not in state, attempt retrieval for grounding
    let docs = state.documents ?? [];
    if (docs.length === 0) {
      try {
        const ragResponse = await ragClient.query(String(question), [], 4);
        docs = ragResponse.sources.map((s) => ({
          pageContent: s.content,
          metadata: s.metadata,
        })) as Document[];
      } catch {
        docs = [];
      }
    }

    const context = docs
      .map((doc, idx) => {
        const source = formatSourceLabel(doc);
        return `[Source ${idx + 1}: ${source}]\n${doc.pageContent}`;
      })
      .join("\n\n---\n\n");

    const systemPrompt = `You are a specialized flashcard generator for students.
Create a set of 10 high-quality, comprehensive flashcards based on the user request and provided context.

OUTPUT FORMAT:
You MUST return a STRICT, valid JSON object without any Markdown fences or external text.

JSON Schema:
{
  "flashcards": [
    {
      "id": 1,
      "question": "Clear, specific question",
      "answer": "Concise, complete answer",
      "difficulty": "easy" | "medium" | "hard",
      "tags": ["topic1", "topic2"]
    }
  ],
  "metadata": {
    "topic": "Main Topic",
    "source": "Document Source or General Knowledge",
    "count": 10
  }
}`;

    const userPrompt = `Request: ${question}\n\nContext:\n${context || "Use general domain knowledge to create accurate study cards."}`;

    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    let raw = typeof response === "string" ? response : JSON.stringify(response);
    // Strip markdown code fences if model wrapped the JSON
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonContent = jsonMatch ? jsonMatch[0] : raw;

    // Validate JSON parsing
    JSON.parse(jsonContent);

    return {
      documents: docs,
      messages: [new AIMessage({ content: jsonContent })],
    };
  } catch (error) {
    logger.error("[FlashcardNode] Generation failed", error);
    return {
      messages: [
        new AIMessage({
          content: JSON.stringify({
            flashcards: [],
            metadata: { topic: "Error", source: "System", count: 0 },
            error: "Failed to generate flashcards. Please try again with a specific topic.",
          }),
        }),
      ],
    };
  }
}

/**
 * Handles explicit memory commands (remember, forget, recall, temporary mode).
 */
export function createMemoryNode(memoryManager: MemoryManager) {
  return async function memoryNode(
    state: StudyAgentStateType
  ): Promise<Partial<StudyAgentStateType>> {
    try {
      const lastMessage = state.messages[state.messages.length - 1];
      const query = (
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content)
      ).trim();

      const lowerQuery = query.toLowerCase();
      let result: string;

      if (
        lowerQuery.includes("temporary chat") ||
        lowerQuery.includes("do not save") ||
        lowerQuery.includes("don't save") ||
        lowerQuery.includes("temporary mode")
      ) {
        result = memoryManager.executeMemoryCommand("temporary_mode");
      } else if (
        lowerQuery.includes("what do you know about me") ||
        lowerQuery.includes("what do you remember") ||
        lowerQuery.includes("show me my memory") ||
        lowerQuery.includes("show memory") ||
        lowerQuery.includes("my memories")
      ) {
        const rawMemory = memoryManager.executeMemoryCommand("recall");
        const model = createNVIDIAOpenAIChat({ temperature: 0.2 });
        const memoryPrompt = `The user asked about their saved memories. Here is the raw memory file contents:

${rawMemory}

Present this information back to the user in a friendly, organized, and encouraging way. If no facts are saved yet, let them know warmly. Maintain your persona as Alex the study mentor.`;

        result = await model.invoke([
          { role: "system", content: STUDY_MENTOR_SYSTEM_PROMPT },
          { role: "user", content: memoryPrompt },
        ]);
      } else if (
        lowerQuery.startsWith("forget") ||
        lowerQuery.startsWith("delete") ||
        lowerQuery.includes("remove memory")
      ) {
        const toForget = query
          .replace(/\b(forget|delete|remove)\b/gi, "")
          .replace(/\b(memory|that|this|about|my)\b/gi, "")
          .trim();
        result = memoryManager.executeMemoryCommand("forget", toForget || query);
      } else if (
        lowerQuery.startsWith("remember") ||
        lowerQuery.startsWith("save this") ||
        lowerQuery.startsWith("note this")
      ) {
        const toRemember = query
          .replace(/\b(remember|save|note)\b/gi, "")
          .replace(/\b(this|that|please)\b/gi, "")
          .trim();
        result = memoryManager.executeMemoryCommand("remember", toRemember || query);
      } else {
        result = memoryManager.executeMemoryCommand("recall");
      }

      return {
        messages: [new AIMessage({ content: result })],
      };
    } catch (error) {
      logger.error("[MemoryNode] Memory command execution failed", error);
      return {
        messages: [
          new AIMessage({
            content: "I had trouble processing that memory command. Could you try again? 😊",
          }),
        ],
      };
    }
  };
}

