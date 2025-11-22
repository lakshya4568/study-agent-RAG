import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import type { CompiledStateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { StudyAgentStateType } from "./state";
import { StudyAgentState } from "./state";
import { createQueryNode, retrieveNode, routeNode, flashcardNode } from "./nodes";

export async function createStudyMentorGraph(
  tools: ConstructorParameters<typeof ToolNode>[0]
): Promise<
  CompiledStateGraph<StudyAgentStateType, Partial<StudyAgentStateType>>
> {
  const toolNode = new ToolNode(tools);
  const queryNode = createQueryNode(tools as any[]);

  const workflow = new StateGraph(StudyAgentState)
    .addNode("router", routeNode)
    .addNode("query", queryNode)
    .addNode("retrieve", retrieveNode)
    .addNode("tools", toolNode)
    .addNode("flashcard", flashcardNode);

  workflow.addEdge(START, "router");

  workflow.addConditionalEdges("router", (state) => state.route, {
    rag: "retrieve",
    tool: "query",
    general: "query",
    flashcard: "flashcard",
  });

  // If we came to flashcard via a direct route but wanted content, maybe we should have gone through RAG first?
  // Actually, let's make the flashcard node smarter or route via RAG if needed.
  // For now, let's assume the router detects "flashcard" intent.
  // If the user wants flashcards FROM a document, the router might need to know that.
  // A better flow might be: Router -> RAG -> Flashcard OR Router -> Flashcard.
  // To support RAG context for flashcards, we can change the routing logic slightly
  // or let the flashcard node be the destination after RAG if the intent was flashcards.
  // But to keep it simple per requirements:
  // "Update the graph workflow... Create edge: router → flashcard → END"

  workflow.addEdge("flashcard", END);

  workflow.addEdge("retrieve", "query");

  workflow.addConditionalEdges(
    "query",
    (state) => {
      const lastMsg = state.messages[state.messages.length - 1];
      const hasToolCalls =
        typeof lastMsg === "object" &&
        lastMsg !== null &&
        "tool_calls" in lastMsg &&
        Array.isArray((lastMsg as { tool_calls?: unknown }).tool_calls) &&
        ((lastMsg as { tool_calls?: unknown[] }).tool_calls?.length ?? 0) > 0;
      return hasToolCalls ? "tools" : END;
    },
    {
      tools: "tools",
      [END]: END,
    }
  );

  workflow.addEdge("tools", "query");

  const checkpointer = new MemorySaver();
  return workflow.compile({ checkpointer }) as CompiledStateGraph<
    StudyAgentStateType,
    Partial<StudyAgentStateType>
  >;
}
