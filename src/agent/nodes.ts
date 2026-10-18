import { SystemMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import { z } from "zod";
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

export const FlashcardItemSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  question: z.string().min(1, "Question cannot be empty"),
  answer: z.string().min(1, "Answer cannot be empty"),
  difficulty: z.enum(["easy", "medium", "hard"]).catch("medium"),
  tags: z.array(z.string()).catch(["Study"]),
});

export const FlashcardResponseSchema = z.object({
  flashcards: z.array(FlashcardItemSchema).min(1),
  metadata: z
    .object({
      topic: z.string().optional().default("Study Topic"),
      source: z.string().optional().default("General Knowledge"),
      count: z.number().optional(),
    })
    .optional()
    .default({ topic: "Study Topic", source: "General Knowledge" }),
});

export type FlashcardResponseType = z.infer<typeof FlashcardResponseSchema>;

export const STUDY_MENTOR_SYSTEM_PROMPT = `You are Alex, an intelligent, enthusiastic, and supportive AI Study Mentor! 🎓

Your Personality & Voice:
- Friendly, warm, and encouraging — like a world-class mentor who makes complex topics crystal clear
- Genuinely excited about learning and celebrating every student breakthrough
- Patient and non-judgmental — no question is too basic
- Conversational tone with clean formatting (bullet points, bold highlights, concise analogies)

COGNITIVE MEMORY SYSTEM:
- You have persistent long-term cognitive memory across sessions.
- You retain the student's study goals, preferred subjects, skill level, and personal context.
- If the user asks "what do you remember about me?" or "show my memory", provide an encouraging summary of their study profile and remind them they can save facts anytime with "remember [fact]".

MCP TOOL CAPABILITIES & INTEGRATIONS:
- You have full Model Context Protocol (MCP) integration with the following connected servers:
  1. Date & Time Engine: Real-time clock, timezone conversions, date arithmetic.
  2. Study Tools: Quiz generation, study progress tracking, comprehensive mastery reports.
  3. Google Forms Engine: Form structure inspection, question retrieval, response aggregation.
  4. Context7 Knowledge: Live technical documentation, framework references, library lookup.
  5. Vector Knowledge Base: Semantic vector retrieval over uploaded PDFs, textbooks, and notes.
- When the user asks questions that require tools (e.g. current time, quiz creation, documentation, study tracking), invoke the appropriate tool. The system will request user permission and return the execution data.
- When asked "what MCP tools do you have?" or "what tools are connected?", explain all your capabilities in an organized, friendly way.

When Using Retrieved Context:
- Reference sources as [Source N] when citing uploaded materials
- If information is not in the provided documents, state that clearly and offer general educational guidance.`;

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
      lowerQuery.includes("flashcard") ||
      lowerQuery.includes("flash card") ||
      lowerQuery.includes("flash-card") ||
      lowerQuery.includes("study card") ||
      lowerQuery.includes("practice card") ||
      lowerQuery.includes("anki") ||
      /\b(make|create|generate|build|give me|show)\b[\s\S]*?\b(cards|flashcards)\b/i.test(query)
    ) {
      logger.info("[Router] Fast-path detected flashcard intent");
      return { route: "flashcard" };
    }

    // Fast-path heuristic for tool queries (time, date, quiz, mcp)
    if (
      lowerQuery.includes("time in") ||
      lowerQuery.includes("current time") ||
      lowerQuery.includes("what time") ||
      lowerQuery.includes("clock") ||
      lowerQuery.includes("date today") ||
      lowerQuery.includes("timezone") ||
      lowerQuery.includes("mcp tool") ||
      lowerQuery.includes("what tools")
    ) {
      logger.info("[Router] Fast-path detected tool intent");
      return { route: "tool" };
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
    const model = createNVIDIAOpenAIChat({
      model: state.selectedModel || undefined,
      provider: (state.selectedProvider as any) || undefined,
      temperature: 0.1,
      maxTokens: 400,
    });
    const prompt = `You are an intelligent intent router for the AI Study Agent.
Decide the single best route for the user query.

Context:
- Knowledge base has documents loaded: ${hasLoadedDocs ? "YES" : "NO"}
- Previous route: ${state.route || "none"}

Options:
- "memory": User explicitly asks to save personal facts, note something to remember, or view saved memory profile.
- "flashcard": User explicitly asks to create or generate flashcards or quiz cards.
- "rag": User asks about study materials, uploaded documents, summaries of content, concept explanations from documents, or questions to find/extract from knowledge base.
- "tool": User asks for system tools (current time, convert timezones, calculate, run MCP tool).
- "general": Greetings, casual study advice, or general conversation.

User Query: "${query}"

Return ONLY one word: memory, flashcard, rag, tool, or general.`;

    const rawResponse = await model.invoke([{ role: "user", content: prompt }]);
    const cleanRoute = rawResponse
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .toLowerCase()
      .trim();

    logger.info(`[Router] Raw: "${rawResponse.substring(0, 60)}" -> Parsed: "${cleanRoute}"`);

    const match = cleanRoute.match(/\b(memory|flashcard|rag|tool|general)\b/);
    if (match) {
      const route = match[1];
      if (route === "memory") return { route: "memory" };
      if (route === "flashcard") return { route: "flashcard" };
      if (route === "rag") return { route: "rag" };
      if (route === "tool") return { route: "tool" };
      if (route === "general") return { route: "general" };
    }

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
      const model = createNVIDIAOpenAIChat({
        model: state.selectedModel || undefined,
        provider: (state.selectedProvider as any) || undefined,
        temperature: 0.3,
      });

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
        `[QueryNode] [Model: ${model.getModelName()} | Provider: ${model.getProvider()}] Assembled ${openAIMessages.length} message slots (RAG docs: ${state.documents?.length ?? 0})`
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
 * Highly resilient parser that extracts structured flashcards from any model output
 * (clean JSON, malformed JSON, unclosed arrays, trailing commas, or markdown text flashcards).
 */
export function repairAndExtractFlashcards(
  rawText: string,
  topic = "Study Topic"
): FlashcardResponseType {
  // 1. Remove reasoning tokens (<think>...</think>)
  let text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Strip code block markers
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // 3. Attempt direct JSON parsing if brackets exist
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    let candidate = text.substring(firstBrace, lastBrace + 1);

    // Clean common LLM JSON syntax errors (trailing commas, control characters)
    candidate = candidate
      .replace(/,\s*([\]}])/g, "$1")
      .replace(/\r\n/g, "\n")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");

    try {
      const parsed = JSON.parse(candidate);
      const validated = FlashcardResponseSchema.safeParse(parsed);
      if (validated.success && validated.data.flashcards.length > 0) {
        return validated.data;
      }
    } catch {
      // Continue to advanced repair
    }
  }

  // 4. Try parsing individual JSON objects {"question": ..., "answer": ...} inside text
  const objectRegex =
    /\{[\s\S]*?"question"\s*:\s*"([\s\S]*?)"[\s\S]*?"answer"\s*:\s*"([\s\S]*?)"[\s\S]*?\}/gi;
  const extractedCards: Array<{
    question: string;
    answer: string;
    difficulty: "easy" | "medium" | "hard";
    tags: string[];
  }> = [];

  let match;
  while ((match = objectRegex.exec(text)) !== null) {
    try {
      const objText = match[0]
        .replace(/,\s*([\]}])/g, "$1")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
      const parsedObj = JSON.parse(objText);
      if (parsedObj.question && parsedObj.answer) {
        extractedCards.push({
          question: String(parsedObj.question).trim(),
          answer: String(parsedObj.answer).trim(),
          difficulty: ["easy", "medium", "hard"].includes(parsedObj.difficulty)
            ? parsedObj.difficulty
            : "medium",
          tags: Array.isArray(parsedObj.tags) ? parsedObj.tags : [topic],
        });
      }
    } catch {
      if (match[1] && match[2]) {
        extractedCards.push({
          question: match[1].replace(/\\"/g, '"').trim(),
          answer: match[2].replace(/\\"/g, '"').trim(),
          difficulty: "medium",
          tags: [topic],
        });
      }
    }
  }

  if (extractedCards.length > 0) {
    return {
      flashcards: extractedCards.map((c, i) => ({ id: i + 1, ...c })),
      metadata: {
        topic,
        source: "AI Tutor",
        count: extractedCards.length,
      },
    };
  }

  // 5. Fallback: Parse markdown formatted flashcards (e.g. **🃏 Flashcard 1** \n **Q:** ... \n **A:** ...)
  const markdownCards: Array<{
    question: string;
    answer: string;
    difficulty: "easy" | "medium" | "hard";
    tags: string[];
  }> = [];
  const lines = text.split("\n");
  let currentQ = "";
  let currentA = "";

  for (const line of lines) {
    const trimmed = line.trim();
    const qMatch = trimmed.match(/^\*?\*?(?:Q|Question)\d*\s*:?\*?\*?\s*(.+)/i);
    const aMatch = trimmed.match(/^\*?\*?(?:A|Answer)\d*\s*:?\*?\*?\s*(.+)/i);

    if (qMatch) {
      if (currentQ && currentA) {
        markdownCards.push({
          question: currentQ,
          answer: currentA,
          difficulty: "medium",
          tags: [topic],
        });
        currentQ = "";
        currentA = "";
      }
      currentQ = qMatch[1].replace(/\*\*/g, "").trim();
    } else if (aMatch) {
      currentA = aMatch[1].replace(/\*\*/g, "").trim();
    } else if (
      currentA &&
      trimmed &&
      !trimmed.startsWith("**🃏") &&
      !trimmed.startsWith("###") &&
      !trimmed.startsWith("---")
    ) {
      currentA += " " + trimmed.replace(/\*\*/g, "").trim();
    } else if (
      currentQ &&
      !currentA &&
      trimmed &&
      !trimmed.startsWith("**🃏") &&
      !trimmed.startsWith("###") &&
      !trimmed.startsWith("---")
    ) {
      currentQ += " " + trimmed.replace(/\*\*/g, "").trim();
    }
  }

  if (currentQ && currentA) {
    markdownCards.push({
      question: currentQ,
      answer: currentA,
      difficulty: "medium",
      tags: [topic],
    });
  }

  if (markdownCards.length > 0) {
    return {
      flashcards: markdownCards.map((c, i) => ({ id: i + 1, ...c })),
      metadata: {
        topic,
        source: "AI Tutor",
        count: markdownCards.length,
      },
    };
  }

  throw new Error("Could not parse flashcards from model output");
}

/**
 * Generates structured flashcards from context or topic with guaranteed JSON formatting.
 */
export async function flashcardNode(
  state: StudyAgentStateType
): Promise<Partial<StudyAgentStateType>> {
  try {
    const model = createNVIDIAOpenAIChat({
      model: state.selectedModel || undefined,
      provider: (state.selectedProvider as any) || undefined,
      temperature: 0.2,
      maxTokens: 3500,
      responseFormat: { type: "json_object" },
    });

    const userMessages = state.messages.filter(
      (msg) => msg._getType?.() === "human" || (msg as { role?: string }).role === "user"
    );
    const question = String(userMessages[userMessages.length - 1]?.content || "Study topic");

    // Clean topic name for metadata
    const cleanTopic = question
      .replace(/\b(create|generate|make|practice|high-yield|study|flashcards?|cards?|for|on|about)\b/gi, "")
      .replace(/[^\w\s]/g, "")
      .trim() || "Study Topic";

    // If documents are not in state, attempt retrieval for grounding
    let docs = state.documents ?? [];
    if (docs.length === 0) {
      try {
        const ragResponse = await ragClient.query(question, [], 4);
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

    const systemPrompt = `You are an expert educational flashcard creator.
Generate a set of 5 to 10 high-yield, comprehensive flashcards.

OUTPUT SPECIFICATION:
You MUST respond with a pure JSON object adhering to this exact schema:
{
  "flashcards": [
    {
      "id": 1,
      "question": "Concise, conceptual question testing core understanding",
      "answer": "Clear, complete explanation and key takeaway",
      "difficulty": "easy" | "medium" | "hard",
      "tags": ["Subject", "Subtopic"]
    }
  ],
  "metadata": {
    "topic": "${cleanTopic}",
    "source": "Study Materials",
    "count": 5
  }
}`;

    const userPrompt = `Generate flashcards for: ${question}\n\nReference Material:\n${
      context || "Use accurate domain expertise to craft clear, active-recall study flashcards."
    }`;

    const response = await model.invoke(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: { type: "json_object" } }
    );

    const raw = typeof response === "string" ? response : JSON.stringify(response);
    const structuredResult = repairAndExtractFlashcards(raw, cleanTopic);

    logger.info(
      `[FlashcardNode] Successfully extracted ${structuredResult.flashcards.length} structured flashcards for topic: "${cleanTopic}"`
    );

    return {
      documents: docs,
      messages: [new AIMessage({ content: JSON.stringify(structuredResult) })],
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
        const model = createNVIDIAOpenAIChat({
          model: state.selectedModel || undefined,
          provider: (state.selectedProvider as any) || undefined,
          temperature: 0.2,
        });
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
        const model = createNVIDIAOpenAIChat({
          model: state.selectedModel || undefined,
          provider: (state.selectedProvider as any) || undefined,
          temperature: 0.3,
        });
        result = await model.invoke([
          { role: "system", content: STUDY_MENTOR_SYSTEM_PROMPT },
          { role: "user", content: query },
        ]);
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

