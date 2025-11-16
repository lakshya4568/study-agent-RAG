import path from "node:path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import type { ChromaClient } from "chromadb";
import type { Document } from "@langchain/core/documents";
import { createNVIDIAEmbeddings } from "../models/nvidia-embeddings";
import { logger } from "../client/logger";
import { InMemoryChromaClient } from "./in-memory-chroma-client";

const CHROMA_COLLECTION_NAME = "study_materials";

/**
 * Creates an in-memory ChromaDB vector store for study materials
 * Uses NVIDIA embeddings for optimal semantic search performance
 * No external server required - runs embedded in Node.js process
 */
export async function createStudyMaterialVectorStore(
  documents: Document[]
): Promise<Chroma> {
  logger.info(
    `Initializing in-memory ChromaDB vector store with ${documents.length} documents`
  );

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const chunks = await splitter.splitDocuments(documents);
  logger.info(`Split into ${chunks.length} chunks for embedding`);

  try {
    // Create in-memory ChromaDB vector store (no external HTTP server)
    const inMemoryIndex = new InMemoryChromaClient() as unknown as ChromaClient;

    const vectorStore = await Chroma.fromDocuments(
      chunks,
      createNVIDIAEmbeddings(),
      {
        collectionName: CHROMA_COLLECTION_NAME,
        collectionMetadata: {
          "hnsw:space": "cosine",
        },
        index: inMemoryIndex,
      }
    );

    logger.info(`In-memory ChromaDB vector store initialized successfully`);
    return vectorStore;
  } catch (error) {
    logger.error("Failed to initialize ChromaDB", error);
    throw new Error(
      `ChromaDB initialization failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Creates a retriever tool for the agent to search study materials
 */
export function createRetrieverTool(vectorStore: Chroma) {
  return {
    name: "retrieve_study_material",
    description:
      "Search through ingested study materials, lecture notes, and documentation. Use this to find relevant context before answering questions.",
    func: async (query: string) => {
      try {
        const results = await vectorStore.similaritySearch(query, 5);
        logger.info(
          `Retrieved ${results.length} documents for query: ${query.substring(0, 50)}...`
        );
        return results
          .map(
            (doc, idx) =>
              `[Document ${idx + 1}]\n${doc.pageContent}\nSource: ${doc.metadata?.source || "unknown"}\n`
          )
          .join("\n---\n\n");
      } catch (error) {
        logger.error("Retrieval failed", error);
        return "Error: Could not retrieve documents. Please try again.";
      }
    },
  } as const;
}
