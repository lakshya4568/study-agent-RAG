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
 * RAG Configuration optimized for NVIDIA embeddings
 * - Model context: 512 tokens (~2048 chars)
 * - Target chunk size: 350 tokens (~1400 chars) to stay well below limit
 * - Overlap: 50 tokens (~200 chars) for context continuity
 * - Separators: Prioritize semantic boundaries
 */
const RAG_CONFIG = {
  chunkSize: 1400,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", ". ", "! ", "? ", "; ", ": ", " ", ""],
  minChunkSize: 100,
  maxChunks: 5000,
} as const;

/**
 * Creates an in-memory ChromaDB vector store for study materials
 * Uses NVIDIA embeddings for optimal semantic search performance
 * No external server required - runs embedded in Node.js process
 *
 * Features:
 * - Optimized chunking for NVIDIA's 512 token context window
 * - Semantic boundary preservation
 * - Rich metadata for source tracking
 * - Cosine similarity for retrieval
 *
 * @param documents - Array of documents to index
 * @returns Configured Chroma vector store
 */
export async function createStudyMaterialVectorStore(
  documents: Document[]
): Promise<Chroma> {
  const startTime = Date.now();
  logger.info(
    `Initializing RAG pipeline with ${documents.length} source documents`
  );

  if (documents.length === 0) {
    throw new Error("Cannot create vector store with zero documents");
  }

  // Configure text splitter for optimal NVIDIA embedding performance
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: RAG_CONFIG.chunkSize,
    chunkOverlap: RAG_CONFIG.chunkOverlap,
    separators: RAG_CONFIG.separators,
    lengthFunction: (text: string) => text.length,
  });

  logger.info("Splitting documents into semantic chunks...");
  const chunks = await splitter.splitDocuments(documents);

  // Validate chunks
  const validChunks = chunks.filter((chunk) => {
    const content = chunk.pageContent.trim();
    return content.length >= RAG_CONFIG.minChunkSize;
  });

  if (validChunks.length !== chunks.length) {
    logger.warn(
      `Filtered out ${chunks.length - validChunks.length} chunks below minimum size (${RAG_CONFIG.minChunkSize} chars)`
    );
  }

  if (validChunks.length > RAG_CONFIG.maxChunks) {
    logger.warn(
      `Document set produced ${validChunks.length} chunks, truncating to ${RAG_CONFIG.maxChunks} for performance`
    );
    validChunks.splice(RAG_CONFIG.maxChunks);
  }

  logger.info(
    `Created ${validChunks.length} semantic chunks (avg: ${Math.round(validChunks.reduce((sum, c) => sum + c.pageContent.length, 0) / validChunks.length)} chars/chunk)`
  );

  try {
    logger.info("Creating NVIDIA embeddings and vector store...");

    // Create in-memory ChromaDB vector store (no external HTTP server)
    const inMemoryIndex = new InMemoryChromaClient() as unknown as ChromaClient;
    const embeddings = createNVIDIAEmbeddings();

    const vectorStore = await Chroma.fromDocuments(validChunks, embeddings, {
      collectionName: CHROMA_COLLECTION_NAME,
      collectionMetadata: {
        "hnsw:space": "cosine", // Cosine similarity for semantic search
        description: "Study materials indexed with NVIDIA embeddings",
        version: "1.0",
        created: new Date().toISOString(),
      },
      index: inMemoryIndex,
    });

    const duration = Date.now() - startTime;
    logger.info(
      `✅ RAG pipeline ready! Indexed ${validChunks.length} chunks in ${duration}ms`
    );
    logger.info(
      `   Collection: ${CHROMA_COLLECTION_NAME} | Embeddings: NVIDIA nv-embedqa-e5-v5 | Dimensions: 1024`
    );

    return vectorStore;
  } catch (error) {
    logger.error("Failed to initialize RAG pipeline", error);

    if (error instanceof Error) {
      if (error.message.includes("API")) {
        throw new Error(
          "NVIDIA API error - check your NVIDIA_API_KEY environment variable"
        );
      }
      throw new Error(`RAG initialization failed: ${error.message}`);
    }

    throw new Error("RAG initialization failed with unknown error");
  }
}

/**
 * Creates a retriever tool for the agent to search study materials
 * Uses semantic similarity search with NVIDIA embeddings
 *
 * @param vectorStore - Configured Chroma vector store
 * @param k - Number of documents to retrieve (default: 5)
 * @returns LangChain-compatible tool for agent
 */
export function createRetrieverTool(vectorStore: Chroma, k: number = 5) {
  return {
    name: "retrieve_study_material",
    description:
      "Search through ingested study materials, lecture notes, and documentation using semantic similarity. " +
      "Use this tool BEFORE answering questions to find relevant context. " +
      "Input should be a clear, specific query about the topic you need information on.",
    func: async (query: string) => {
      try {
        if (!query || query.trim().length === 0) {
          return "Error: Query cannot be empty. Please provide a specific search query.";
        }

        logger.info(`🔍 Searching for: "${query.substring(0, 80)}..."`);
        const startTime = Date.now();

        // Perform semantic similarity search with score threshold
        const results = await vectorStore.similaritySearchWithScore(query, k);
        const duration = Date.now() - startTime;

        if (results.length === 0) {
          logger.warn("No relevant documents found");
          return "No relevant information found in the knowledge base for this query. Consider answering from general knowledge or asking for clarification.";
        }

        logger.info(
          `   Found ${results.length} relevant chunks (${duration}ms) | Avg similarity: ${(results.reduce((sum, [_, score]) => sum + score, 0) / results.length).toFixed(3)}`
        );

        // Format results with source citations and relevance scores
        const formattedResults = results
          .map(([doc, score], idx) => {
            const source = doc.metadata?.source || "unknown";
            const fileName = doc.metadata?.fileName || source;
            const relevance = (1 - score).toFixed(2); // Convert distance to similarity

            return (
              `[Source ${idx + 1}: ${fileName} | Relevance: ${relevance}]\n` +
              `${doc.pageContent.trim()}\n`
            );
          })
          .join("\n---\n\n");

        return (
          `Retrieved ${results.length} relevant passages:\n\n` +
          formattedResults +
          `\n\n💡 Use these sources to provide an accurate, well-referenced answer.`
        );
      } catch (error) {
        logger.error("Retrieval failed", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        return `Error during retrieval: ${errorMsg}. The system may need to reinitialize.`;
      }
    },
  } as const;
}

/**
 * Advanced retrieval with score filtering
 * Returns only results above a similarity threshold
 */
export async function retrieveWithScoreFilter(
  vectorStore: Chroma,
  query: string,
  k: number = 5,
  minSimilarity: number = 0.7
): Promise<Array<[Document, number]>> {
  const results = await vectorStore.similaritySearchWithScore(query, k);

  // Filter by minimum similarity (convert distance to similarity: 1 - distance)
  const filtered = results.filter(([_, score]) => 1 - score >= minSimilarity);

  logger.debug(
    `Filtered ${results.length} results to ${filtered.length} above ${minSimilarity} similarity`
  );

  return filtered;
}

/**
 * Export RAG configuration for testing and debugging
 */
export { RAG_CONFIG };
