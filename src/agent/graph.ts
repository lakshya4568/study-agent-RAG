import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import type { CompiledStateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { StudyAgentStateType } from "./state";
import { StudyAgentState } from "./state";
import {
  createQueryNode,
  retrieveNode,
  routeNode,
  flashcardNode,
  createMemoryNode,
} from "./nodes";
import type { MemoryManager } from "./MemoryManager";

export async function createStudyMentorGraph(
  tools: ConstructorParameters<typeof ToolNode>[0],
  memoryManager: MemoryManager
): Promise<
  CompiledStateGraph<StudyAgentStateType, Partial<StudyAgentStateType>>
> {
  const toolNode = new ToolNode(tools);
  const queryNode = createQueryNode(tools as any[]);
  const memoryNode = createMemoryNode(memoryManager);

  const workflow = new StateGraph(StudyAgentState)
    .addNode("router", routeNode)
    .addNode("query", queryNode)
    .addNode("retrieve", retrieveNode)
    .addNode("tools", toolNode)
    .addNode("flashcard", flashcardNode)
    .addNode("memory", memoryNode);

  workflow.addEdge(START, "router");

  workflow.addConditionalEdges("router", (state) => state.route, {
    rag: "retrieve",
    tool: "query",
    general: "query",
    flashcard: "flashcard",
    memory: "memory",
  });

  workflow.addEdge("retrieve", "query");
  workflow.addEdge("query", END);
  workflow.addEdge("flashcard", END);
  workflow.addEdge("memory", END);

  const checkpointer = new MemorySaver();
  return workflow.compile({ checkpointer }) as CompiledStateGraph<
    StudyAgentStateType,
    Partial<StudyAgentStateType>
  >;
}

