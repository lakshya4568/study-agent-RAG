import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import type { CompiledStateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { MemoryVectorStore } from "langchain/vectorstores/memory";
import type { StudyAgentStateType } from "./state";
import { StudyAgentState } from "./state";
import { queryNode, retrieveNode, generateNode } from "./nodes";

export async function createStudyMentorGraph(
  vectorStore: MemoryVectorStore,
  tools: ConstructorParameters<typeof ToolNode>[0]
): Promise<
  CompiledStateGraph<StudyAgentStateType, Partial<StudyAgentStateType>>
> {
  const toolNode = new ToolNode(tools);

  const workflow = new StateGraph(StudyAgentState)
    .addNode("query", queryNode)
    .addNode("retrieve", (state: StudyAgentStateType) =>
      retrieveNode(state, vectorStore)
    )
    .addNode("tools", toolNode)
    .addNode("generate", generateNode);

  workflow.addEdge(START, "query");
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
      return hasToolCalls ? "tools" : "retrieve";
    },
    {
      tools: "tools",
      retrieve: "retrieve",
    }
  );
  workflow.addEdge("tools", "generate");
  workflow.addEdge("retrieve", "generate");
  workflow.addEdge("generate", END);

  const checkpointer = new MemorySaver();
  return workflow.compile({ checkpointer }) as CompiledStateGraph<
    StudyAgentStateType,
    Partial<StudyAgentStateType>
  >;
}
