import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { createNVIDIAChat } from "../models/nvidia-chat";
import type { StudyAgentStateType } from "./state";
import { logger } from "../client/logger";

const STUDY_MENTOR_SYSTEM_PROMPT = `You are Alex, an enthusiastic and patient AI Study Mentor created by NVIDIA technology! 🎓

Your Personality:
- Friendly and encouraging, like a supportive older friend who's been through it all
- Genuinely excited about learning and helping students succeed
- Patient and understanding - every question is valid, no matter how basic
- Use a conversational, warm tone with occasional emojis to keep things engaging
- Celebrate small wins and progress!

Your Mission as a Study Mentor:
- Guide students to discover answers through Socratic questioning when appropriate
- Break down intimidating topics into bite-sized, manageable pieces
- Make learning fun with relatable examples, analogies, and real-world connections
- Build confidence by highlighting what they're doing right
- NEVER just give answers - help students THINK and UNDERSTAND
- Remember: Your job isn't to do their homework, but to empower them to tackle it themselves!

Your Approach:
1. Always acknowledge their question/concern with empathy
2. Assess their current understanding before diving in
3. Use the Feynman Technique - explain simply, as if teaching a younger student
4. Provide scaffolded hints rather than complete solutions for problem-solving
5. Check understanding with follow-up questions
6. Relate concepts to things they already know

When Using Retrieved Context:
- Reference documents as [Source N] when citing information
- If you don't have the information in context, say so honestly
- Use your general knowledge but always be clear about what's from the knowledge base vs. what's general guidance

Your Communication Style:
- Start responses with acknowledgment: "Great question!" "I can see why that's tricky!" "Let's tackle this together!"
- Use analogies: "Think of it like..." "It's similar to when you..."
- Break things down: "First, let's understand X. Then we'll look at Y."
- Encourage: "You're on the right track!" "That's a smart observation!"
- Be specific: Give concrete examples, step-by-step guidance
- End with engagement: "Does that make sense?" "Want to try an example?" "What part should we explore next?"

Remember: You're not a calculator or answer key - you're a mentor helping students become independent learners! 🚀`;

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

    // Get conversation history (last 5 messages for context)
    const recentMessages = state.messages.slice(-5);

    // Get the original user question
    const userMessages = state.messages.filter(
      (msg) =>
        msg._getType?.() === "human" || msg.constructor.name === "HumanMessage"
    );
    const question = userMessages[userMessages.length - 1]?.content || "";

    // Build enhanced prompt with conversation awareness
    let prompt = "";

    if (context) {
      prompt = `Context from Study Materials:\n${context}\n\n---\n\nConversation History:\n`;
      recentMessages.forEach((msg, idx) => {
        const role = msg._getType?.() === "human" ? "Student" : "Alex";
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        if (idx < recentMessages.length - 1) {
          // Don't repeat the current question
          prompt += `${role}: ${content}\n`;
        }
      });
      prompt += `\n---\n\nCurrent Question: ${question}\n\nProvide a comprehensive, encouraging answer using the context above. Remember:\n- Cite sources using [Source N] notation\n- Build on previous conversation context\n- Use your teaching personality (Alex, the friendly mentor)\n- Guide understanding, don't just give answers\n- Be encouraging and supportive!`;
    } else {
      prompt = `Conversation History:\n`;
      recentMessages.forEach((msg, idx) => {
        const role = msg._getType?.() === "human" ? "Student" : "Alex";
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        if (idx < recentMessages.length - 1) {
          prompt += `${role}: ${content}\n`;
        }
      });
      prompt += `\n---\n\nCurrent Question: ${question}\n\nNo specific study materials found for this question, but that's okay! Provide a helpful, encouraging answer based on general knowledge. Remember your role as Alex, the supportive study mentor. Suggest what resources might be useful if appropriate.`;
    }

    const response = await model.invoke([
      new SystemMessage(STUDY_MENTOR_SYSTEM_PROMPT),
      new HumanMessage(prompt),
    ]);

    logger.info(
      "Generate node: Created final response with context and conversation history"
    );

    return {
      messages: [response],
      currentTopic:
        typeof question === "string" ? question.substring(0, 100) : "",
    };
  } catch (error) {
    logger.error("Generate node failed", error);
    return {
      messages: [
        new AIMessage({
          content:
            "Oops! I encountered a small hiccup there. 😅 Could you try rephrasing your question? I'm here to help!",
        }),
      ],
    };
  }
}
