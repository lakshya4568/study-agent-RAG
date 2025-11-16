import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createNVIDIAChat } from "../models/nvidia-chat";
import type { StudyAgentStateType } from "./state";

export async function queryNode(
  state: StudyAgentStateType
): Promise<Partial<StudyAgentStateType>> {
  const model = createNVIDIAChat();
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

export async function retrieveNode(
  state: StudyAgentStateType,
  vectorStore: MemoryVectorStore
): Promise<Partial<StudyAgentStateType>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const query =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);
  const docs = await vectorStore.similaritySearch(query, 3);

  return {
    documents: docs,
    messages: [
      new SystemMessage({
        content: `Context documents:\n${docs.map((doc, idx) => `(${idx + 1}) ${doc.pageContent}`).join("\n")}`,
      }),
    ],
  };
}

export async function generateNode(
  state: StudyAgentStateType
): Promise<Partial<StudyAgentStateType>> {
  const model = createNVIDIAChat();
  const context = (state.documents ?? [])
    .map((doc) => doc.pageContent)
    .join("\n\n");
  const question = state.messages[state.messages.length - 1];
  const response = await model.invoke([
    new SystemMessage({
      content:
        "You are an encouraging study mentor. Reference the provided context when possible.",
    }),
    new HumanMessage({
      content: `Context:\n${context || "No additional notes available."}\n\nQuestion: ${question.content}`,
    }),
  ]);

  return { messages: [response] };
}
