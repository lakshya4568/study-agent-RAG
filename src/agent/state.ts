import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";

export const StudyAgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (state, update) => state.concat(update),
  }),
  documents: Annotation<Document[]>({
    reducer: (_state, update) => update ?? [],
  }),
  currentTopic: Annotation<string>({
    reducer: (_state, update) => update ?? "",
  }),
  route: Annotation<"general" | "retrieve" | "tool" | "flashcard" | string>({
    reducer: (_state, update) => update ?? "general",
  }),
});

export type StudyAgentStateType = typeof StudyAgentState.State;
