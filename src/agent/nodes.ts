import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { createNVIDIAChat } from "../models/nvidia-chat";
import type { StudyAgentStateType } from "./state";
import { logger } from "../client/logger";

const STUDY_MENTOR_SYSTEM_PROMPT = `You are an expert Study Mentor AI powered by NVIDIA technology and advanced RAG (Retrieval-Augmented Generation).

Your role:
- Help students learn and understand concepts deeply
- Provide accurate, well-structured explanations
- Guide thinking process rather than just giving answers
- Encourage critical thinking and problem-solving
- Always cite sources when using retrieved context

Response Guidelines:
- Be encouraging and supportive
- Break down complex topics into digestible parts
- Use examples and analogies when helpful
- When referencing retrieved documents, cite them as [Source N]
- If information is not in the context, clearly state that and provide general knowledge
- Adapt explanations to the student's level`;

export async function queryNode(
  state: StudyAgentStateType
): Promise<Partial<StudyAgentStateType>> {
  try {
    const model = createNVIDIAChat({
      temperature: 0.3,
      maxTokens: 2000,
    });

    const messages = [
      new SystemMessage(STUDY_MENTOR_SYSTEM_PROMPT),
      ...state.messages,
    ];

    const response = await model.invoke(messages);
    logger.info("Query node: Generated initial response");

    return { messages: [response] };
  } catch (error) {
    logger.error("Query node failed", error);
    return {
      messages: [
        new AIMessage({
          content:
            "I apologize, but I encountered an error processing your query. Please try again.",
        }),
      ],
    };
  }
}

export async function retrieveNode(
  state: StudyAgentStateType,
  vectorStore: Chroma
): Promise<Partial<StudyAgentStateType>> {
  try {
    const lastMessage = state.messages[state.messages.length - 1];
    const query =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    logger.info(
      `Retrieving documents for query: ${query.substring(0, 100)}...`
    );

    // Perform similarity search with metadata
    const docs = await vectorStore.similaritySearch(query, 5);

    if (docs.length === 0) {
      logger.warn("No documents retrieved from vector store");
      return {
        documents: [],
        messages: [
          new SystemMessage({
            content:
              "No relevant context found in the knowledge base. Provide a general answer.",
          }),
        ],
      };
    }

    logger.info(`Retrieved ${docs.length} relevant documents`);

    // Format context with source citations
    const contextWithSources = docs
      .map((doc, idx) => {
        const source = doc.metadata?.source || "unknown";
        const content = doc.pageContent.trim();
        return `[Source ${idx + 1}: ${source}]\n${content}`;
      })
      .join("\n\n---\n\n");

    return {
      documents: docs,
      messages: [
        new SystemMessage({
          content: `Retrieved Context (use these sources to answer):\n\n${contextWithSources}`,
        }),
      ],
    };
  } catch (error) {
    logger.error("Retrieve node failed", error);
    return {
      documents: [],
      messages: [
        new SystemMessage({
          content:
            "Failed to retrieve context. Provide answer based on general knowledge.",
        }),
      ],
    };
  }
}

export async function generateNode(
  state: StudyAgentStateType
): Promise<Partial<StudyAgentStateType>> {
  try {
    const model = createNVIDIAChat({
      temperature: 0.3,
      maxTokens: 2000,
    });

    // Extract context from retrieved documents
    const context = (state.documents ?? [])
      .map((doc, idx) => {
        const source = doc.metadata?.source || "unknown";
        return `[Source ${idx + 1}: ${source}]\n${doc.pageContent}`;
      })
      .join("\n\n---\n\n");

    // Get the original user question
    const userMessages = state.messages.filter(
      (msg) =>
        msg._getType?.() === "human" || msg.constructor.name === "HumanMessage"
    );
    const question = userMessages[userMessages.length - 1]?.content || "";

    const prompt = context
      ? `Context from Study Materials:\n${context}\n\n---\n\nStudent Question: ${question}\n\nProvide a comprehensive answer using the context above. Cite sources using [Source N] notation when referencing specific information.`
      : `Student Question: ${question}\n\nNo specific study materials found. Provide a helpful general answer and suggest what resources might be useful.`;

    const response = await model.invoke([
      new SystemMessage(STUDY_MENTOR_SYSTEM_PROMPT),
      new HumanMessage(prompt),
    ]);

    logger.info("Generate node: Created final response with context");

    return { messages: [response] };
  } catch (error) {
    logger.error("Generate node failed", error);
    return {
      messages: [
        new AIMessage({
          content:
            "I apologize, but I encountered an error generating a response. Please try rephrasing your question.",
        }),
      ],
    };
  }
}
