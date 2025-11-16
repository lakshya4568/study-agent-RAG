import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import type { Document } from "@langchain/core/documents";
import { createNVIDIAEmbeddings } from "../models/nvidia-embeddings";

export async function createStudyMaterialVectorStore(
  documents: Document[]
): Promise<MemoryVectorStore> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitDocuments(documents);
  return MemoryVectorStore.fromDocuments(chunks, createNVIDIAEmbeddings());
}

export function createRetrieverTool(vectorStore: MemoryVectorStore) {
  return {
    name: "retrieve_study_material",
    description: "Search through ingested study materials and lecture notes",
    func: async (query: string) => {
      const results = await vectorStore.similaritySearch(query, 4);
      return results.map((doc) => doc.pageContent).join("\n\n");
    },
  } as const;
}
