import { Embeddings } from "@langchain/core/embeddings";
import { logger } from "../client/logger";

/**
 * NVIDIA's latest NeMo Retriever embedding model
 * Proxies requests to the Python RAG Service to avoid running multiple instances
 * Model: nvidia/llama-3.2-nemoretriever-300m-embed-v2
 */
const NVIDIA_EMBED_MODEL = "nvidia/llama-3.2-nemoretriever-300m-embed-v2";
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8000";

/**
 * NVIDIA Embeddings Client
 * Communicates with the Python RAG Service via HTTP
 */
export class NvidiaEmbeddings extends Embeddings {
  constructor() {
    super({});
    logger.info(
      `Initializing NVIDIA Embeddings Client (via RAG Service at ${RAG_SERVICE_URL})`
    );
  }

  /**
   * Embed documents (passages) for storage in vector database
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      logger.warn("embedDocuments called with empty array");
      return [];
    }

    try {
      const response = await fetch(`${RAG_SERVICE_URL}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`RAG Service error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        embeddings: number[][];
        dimensions: number;
      };
      return data.embeddings;
    } catch (error) {
      logger.error("Failed to embed documents via RAG service:", error);
      throw error;
    }
  }

  /**
   * Embed a query for similarity search
   */
  async embedQuery(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Cannot embed empty query");
    }

    try {
      const embeddings = await this.embedDocuments([text]);
      if (!embeddings || embeddings.length === 0) {
        throw new Error("No embedding returned for query");
      }
      return embeddings[0];
    } catch (error) {
      logger.error("Failed to embed query via RAG service:", error);
      throw error;
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<{
    model: string;
    provider: string;
    type: string;
  }> {
    return {
      model: NVIDIA_EMBED_MODEL,
      provider: "NVIDIA (via RAG Service)",
      type: "retrieval-embeddings",
    };
  }

  /**
   * Clean up (No-op for HTTP client)
   */
  cleanup(): void {
    // No persistent connection to clean up
  }
}

/**
 * Factory function to create NVIDIA Embeddings instance
 *
 * @returns Configured NVIDIA embeddings instance
 */
export function createNVIDIAEmbeddings(): NvidiaEmbeddings {
  return new NvidiaEmbeddings();
}

/**
 * Default configuration for NVIDIA embeddings
 */
export const nvidiaEmbeddingDefaults = {
  modelName: NVIDIA_EMBED_MODEL,
  provider: "NVIDIA",
  type: "retrieval-embeddings",
  apiEndpoint: RAG_SERVICE_URL,
};
