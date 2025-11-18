import path from "node:path";
import { createHash } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { Document } from "@langchain/core/documents";
import { createNVIDIAEmbeddings } from "../models/nvidia-embeddings";
import { logger } from "../client/logger";
import { getChromaServerUrl, getChromaPersistDir } from "./chroma-server";
import { InMemoryChromaClient } from "./in-memory-chroma-client";

/**
 * Sanitizes metadata to only include primitive types (string, number, boolean, null)
 * ChromaDB does not support nested objects or arrays in metadata
 */
function sanitizeMetadata(
  metadata: Record<string, any>
): Record<string, string | number | boolean | null> {
  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    } else if (typeof value === "object") {
      // Convert objects/arrays to JSON strings
      sanitized[key] = JSON.stringify(value);
    } else {
      // Convert any other type to string
      sanitized[key] = String(value);
    }
  }

  return sanitized;
}

const CHROMA_COLLECTION_NAME = "study_materials";

const MODEL_CONTEXT_TOKENS = 8192;
const AVG_CHARS_PER_TOKEN = 4;
const TARGET_CHUNK_TOKENS = 512; // Smaller chunks for better retrieval granularity
const TARGET_CHUNK_OVERLAP_TOKENS = 50; // ~10% overlap

/**
 * RAG Configuration optimized for NVIDIA embeddings
 * - Model context: 8192 tokens (~32k chars) but we use smaller chunks for better retrieval
 * - Target chunk size: 512 tokens (~2k chars) for semantic granularity
 * - Overlap: 50 tokens (~200 chars) for context continuity
 * - Separators: Prioritize semantic boundaries (paragraphs, sentences)
 */
const RAG_CONFIG = {
  chunkSize: TARGET_CHUNK_TOKENS * AVG_CHARS_PER_TOKEN, // ~2048 chars
  chunkOverlap: TARGET_CHUNK_OVERLAP_TOKENS * AVG_CHARS_PER_TOKEN, // ~200 chars
  separators: [
    "\n\n\n", // Multiple blank lines (section breaks)
    "\n\n", // Paragraph breaks
    "\n", // Line breaks
    ". ", // Sentence endings
    "! ",
    "? ",
    "; ",
    ": ",
    ", ", // Clause breaks
    " ", // Word breaks
    "", // Character level (last resort)
  ],
  minChunkSize: 50, // Minimum meaningful content size
  maxChunks: 10000, // Increased limit for larger documents
  contextTokens: MODEL_CONTEXT_TOKENS,
} as const;

export interface DocumentChunkStats {
  absolutePath: string;
  documentId: string;
  origin: string;
  rawChunks: number;
  keptChunks: number;
  droppedShort: number;
  droppedDuplicates: number;
}

export interface ChunkingSummary {
  totalRawChunks: number;
  totalKeptChunks: number;
  droppedShort: number;
  droppedDuplicates: number;
  truncatedChunks: number;
  perDocument: Record<string, DocumentChunkStats>;
}

interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
  maxChunks?: number;
}

function normalizeDocumentId(metadata?: Record<string, unknown>): string {
  const documentId = metadata?.documentId;
  if (typeof documentId === "string" && documentId.length) {
    return documentId;
  }
  const fallbackSource =
    typeof metadata?.source === "string" && metadata.source.length
      ? metadata.source
      : "unknown";
  return createHash("sha1").update(fallbackSource).digest("hex");
}

function normalizeAbsolutePath(metadata?: Record<string, unknown>): string {
  const absolutePath = metadata?.absolutePath;
  if (typeof absolutePath === "string" && absolutePath.length) {
    return path.resolve(absolutePath);
  }
  const relativeSource =
    typeof metadata?.source === "string" && metadata.source.length
      ? metadata.source
      : "unknown";
  return path.resolve(process.cwd(), relativeSource);
}

function normalizeOrigin(metadata?: Record<string, unknown>): string {
  const origin = metadata?.origin;
  if (typeof origin === "string" && origin.length) {
    return origin;
  }
  return "unknown";
}

export async function chunkDocumentsForVectorStore(
  documents: Document[],
  options: ChunkingOptions = {}
): Promise<{ chunks: Document[]; summary: ChunkingSummary }> {
  const config = {
    ...RAG_CONFIG,
    ...options,
  } as const;

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
    separators: [...config.separators],
    lengthFunction: (text: string) => text.length,
  });

  const rawChunks = await splitter.splitDocuments(documents);
  const dedupedChunks: Document[] = [];
  const seenChunkHashes = new Set<string>();
  const perDocument = new Map<string, DocumentChunkStats>();
  let droppedShort = 0;
  let droppedDuplicates = 0;

  const ensureDocStats = (
    absolutePath: string,
    metadata: DocumentChunkStats
  ) => {
    let stats = perDocument.get(absolutePath);
    if (!stats) {
      stats = metadata;
      perDocument.set(absolutePath, stats);
    }
    return stats;
  };

  for (const chunk of rawChunks) {
    const docMetadata = chunk.metadata ?? {};
    const absolutePath = normalizeAbsolutePath(docMetadata);
    const documentId = normalizeDocumentId(docMetadata);
    const origin = normalizeOrigin(docMetadata);
    const stats = ensureDocStats(absolutePath, {
      absolutePath,
      documentId,
      origin,
      rawChunks: 0,
      keptChunks: 0,
      droppedShort: 0,
      droppedDuplicates: 0,
    });

    stats.rawChunks += 1;
    const content = chunk.pageContent.trim();
    if (content.length < config.minChunkSize) {
      stats.droppedShort += 1;
      droppedShort += 1;
      continue;
    }

    const chunkHash = createHash("sha1").update(content).digest("hex");
    const dedupKey = `${documentId}:${chunkHash}`;
    if (seenChunkHashes.has(dedupKey)) {
      stats.droppedDuplicates += 1;
      droppedDuplicates += 1;
      continue;
    }

    seenChunkHashes.add(dedupKey);
    const chunkIndex = stats.keptChunks;
    stats.keptChunks += 1;

    // Sanitize metadata to ensure only primitive types
    const rawMetadata = {
      ...chunk.metadata,
      documentId,
      absolutePath,
      origin,
      chunkHash,
      chunkIndex,
    };

    dedupedChunks.push({
      ...chunk,
      metadata: sanitizeMetadata(rawMetadata),
    });
  }

  let truncatedChunks = 0;
  if (dedupedChunks.length > config.maxChunks) {
    truncatedChunks = dedupedChunks.length - config.maxChunks;
    dedupedChunks.splice(config.maxChunks);
  }

  return {
    chunks: dedupedChunks,
    summary: {
      totalRawChunks: rawChunks.length,
      totalKeptChunks: dedupedChunks.length,
      droppedShort,
      droppedDuplicates,
      truncatedChunks,
      perDocument: Object.fromEntries(
        [...perDocument.entries()].map(([absolutePath, stats]) => [
          absolutePath,
          stats,
        ])
      ),
    },
  };
}

/**
 * Creates a persistent ChromaDB vector store for study materials
 * Uses NVIDIA embeddings for optimal semantic search performance
 * Data is persisted to local disk storage in userData directory
 * Connects to a local ChromaDB HTTP server for data operations
 *
 * Features:
 * - Persistent storage across application restarts
 * - Optimized chunking for NVIDIA's 8192 token context window
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
    `🚀 Initializing RAG pipeline with ${documents.length} source documents`
  );

  if (documents.length === 0) {
    logger.warn("⚠️ Creating vector store with zero documents - fallback mode");
    // Create an empty vector store with a placeholder document
    // This allows the system to initialize properly and accept uploads later
    documents = [
      new Document({
        pageContent:
          "This is a placeholder document. The knowledge base is empty. Please upload study materials to begin.",
        metadata: {
          source: "system",
          origin: "system",
          documentId: "placeholder",
          fileName: "placeholder.txt",
        },
      }),
    ];
  }

  logger.info("📄 Splitting documents into semantic chunks...");
  const { chunks: validChunks, summary } =
    await chunkDocumentsForVectorStore(documents);

  if (validChunks.length === 0) {
    throw new Error(
      "❌ No usable content found in provided documents. " +
        "PDFs must contain selectable/searchable text (not just images). " +
        "If your PDF is image-based, use OCR software to convert it first."
    );
  }

  if (summary.truncatedChunks > 0) {
    logger.warn(
      `Document set produced ${summary.totalKeptChunks + summary.truncatedChunks} chunks, truncated ${summary.truncatedChunks} to stay under limit ${RAG_CONFIG.maxChunks}`
    );
  }

  const avgChunkSize = Math.round(
    validChunks.reduce((sum, chunk) => sum + chunk.pageContent.length, 0) /
      validChunks.length
  );
  logger.info(
    `Created ${validChunks.length} semantic chunks (avg: ${avgChunkSize} chars/chunk)`
  );
  logger.debug(
    `Chunking diagnostics | totalRaw=${summary.totalRawChunks} filteredShort=${summary.droppedShort} duplicates=${summary.droppedDuplicates}`
  );

  const embeddings = createNVIDIAEmbeddings();
  const allowInMemoryFallback =
    process.env.CHROMA_ALLOW_IN_MEMORY_FALLBACK !== "false";
  let usingInMemoryIndex = false;
  let indexClient: ChromaClient;
  let persistDir = getChromaPersistDir();

  try {
    logger.info("📊 Initializing RAG pipeline with persistent storage...");
    logger.info(`Using persistent storage at: ${persistDir}`);

    // Create ChromaClient connected to HTTP server (server persists to disk)
    const serverUrl = new URL(getChromaServerUrl());
    indexClient = new ChromaClient({
      host: serverUrl.hostname,
      port: parseInt(serverUrl.port || "8000"),
    });

    // Verify the server is reachable before loading documents
    await indexClient.listCollections();
  } catch (error) {
    if (!allowInMemoryFallback) {
      const message =
        error instanceof Error ? error.message : "Unknown ChromaDB error";
      throw new Error(
        `RAG initialization failed: ${message}. ` +
          "Ensure the ChromaDB server is running or enable the in-memory fallback by omitting CHROMA_ALLOW_IN_MEMORY_FALLBACK=false."
      );
    }

    usingInMemoryIndex = true;
    persistDir = "in-memory";
    logger.warn(
      "ChromaDB server unavailable. Falling back to in-memory vector store (data will not persist between runs)."
    );
    indexClient = new InMemoryChromaClient() as unknown as ChromaClient;
  }

  try {
    // Ensure all chunks have sanitized metadata
    const sanitizedChunks = validChunks.map((chunk) => ({
      ...chunk,
      metadata: sanitizeMetadata(chunk.metadata || {}),
    }));

    logger.info(
      `🔄 Embedding ${sanitizedChunks.length} chunks with NVIDIA embeddings...`
    );
    logger.debug(`Sample chunk metadata:`, sanitizedChunks[0]?.metadata);

    const vectorStore = await Chroma.fromDocuments(
      sanitizedChunks,
      embeddings,
      {
        collectionName: CHROMA_COLLECTION_NAME,
        collectionMetadata: {
          "hnsw:space": "cosine", // Cosine similarity for semantic search
          description: "Study materials indexed with NVIDIA embeddings",
          version: "1.0",
          created: new Date().toISOString(),
          persistPath: persistDir,
        },
        index: indexClient,
      }
    );

    const duration = Date.now() - startTime;
    logger.info(
      `✅ RAG pipeline ready! Indexed ${validChunks.length} chunks in ${duration}ms`
    );
    logger.info(
      `   Collection: ${CHROMA_COLLECTION_NAME} | Storage: ${usingInMemoryIndex ? "In-memory (non-persistent)" : `Persistent (${persistDir})`}`
    );
    logger.info(
      `   Embeddings: NVIDIA NeMo Retriever | Dimensions: 2048 | Distance: cosine`
    );

    if (usingInMemoryIndex) {
      logger.warn(
        "In-memory mode is intended for tests only. Start the ChromaDB server for persistent storage."
      );
    }

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
 * Initialize or connect to persistent ChromaDB client
 * Ensures the ChromaDB server is running and accessible
 */
export async function initializePersistentChromaClient(): Promise<ChromaClient> {
  try {
    const serverUrl = new URL(getChromaServerUrl());
    const client = new ChromaClient({
      host: serverUrl.hostname,
      port: parseInt(serverUrl.port || "8000"),
    });

    // Test connection by listing collections
    await client.listCollections();
    logger.info(`✅ Connected to ChromaDB server at ${getChromaServerUrl()}`);

    return client;
  } catch (error) {
    logger.error("Failed to connect to ChromaDB server", error);
    throw new Error(
      "ChromaDB server connection failed. The server should have started automatically.\n" +
        "If you see this error, try restarting the application.\n" +
        "Manual start: chroma run --path ./chroma_storage --port 8000"
    );
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
export function createRetrieverTool(vectorStore: Chroma, k = 5) {
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
          `   Found ${results.length} relevant chunks (${duration}ms) | Avg similarity: ${(results.reduce((sum, [, score]) => sum + score, 0) / results.length).toFixed(3)}`
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
  k = 5,
  minSimilarity = 0.7
): Promise<Array<[Document, number]>> {
  const results = await vectorStore.similaritySearchWithScore(query, k);

  // Filter by minimum similarity (convert distance to similarity: 1 - distance)
  const filtered = results.filter(([, score]) => 1 - score >= minSimilarity);

  logger.debug(
    `Filtered ${results.length} results to ${filtered.length} above ${minSimilarity} similarity`
  );

  return filtered;
}

/**
 * Export RAG configuration for testing and debugging
 */
export { RAG_CONFIG };
