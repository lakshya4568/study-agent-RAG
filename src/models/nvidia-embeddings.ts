import { spawn, ChildProcess, execSync } from "child_process";
import path from "path";
import { Embeddings } from "@langchain/core/embeddings";
import { logger } from "../client/logger";

/**
 * NVIDIA's latest NeMo Retriever embedding model
 * Uses Python langchain-nvidia-ai-endpoints via child process bridge
 * Model: nvidia/llama-3.2-nemoretriever-300m-embed-v2
 */
const NVIDIA_EMBED_MODEL = "nvidia/llama-3.2-nemoretriever-300m-embed-v2";
const MAX_EMBED_BATCH = 16;

/**
 * Get the correct Python command for the current platform
 * On Windows: python
 * On macOS/Linux: python3 (fallback to python)
 */
function getPythonCommand(): string {
  if (process.platform === "win32") {
    return "python";
  }

  // Check if python3 exists
  try {
    execSync("which python3", { stdio: "pipe" });
    return "python3";
  } catch {
    return "python";
  }
}

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: Record<string, any>;
  id: number;
}

interface JsonRpcResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number | null;
}

interface JsonRpcNotification {
  jsonrpc: string;
  method: string;
  params?: Record<string, any>;
}

/**
 * NVIDIA Embeddings using official Python langchain-nvidia-ai-endpoints
 * Communicates with Python service via JSON-RPC over stdin/stdout
 */
export class NvidiaEmbeddings extends Embeddings {
  private pythonProcess: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests: Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeoutId?: NodeJS.Timeout;
    }
  > = new Map();
  private initPromise: Promise<void> | null = null;
  private isReady = false;
  private buffer = "";

  constructor() {
    super({});
    logger.info(`Initializing NVIDIA Embeddings: ${NVIDIA_EMBED_MODEL}`);
  }

  /**
   * Initialize the Python embeddings service
   */
  private async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const pythonScript = path.join(
        __dirname,
        "..",
        "..",
        "python",
        "nvidia_embeddings_service.py"
      );

      logger.debug(`Starting Python service: ${pythonScript}`);

      // Check for NVIDIA API key
      if (!process.env.NVIDIA_API_KEY) {
        reject(
          new Error(
            "NVIDIA_API_KEY is not set. Add it to your environment before running the agent."
          )
        );
        return;
      }

      // Spawn Python process with platform-specific command
      const pythonCmd = getPythonCommand();
      logger.info(`Using Python command: ${pythonCmd}`);
      this.pythonProcess = spawn(pythonCmd, [pythonScript], {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
      });

      // Handle stdout (JSON-RPC responses)
      this.pythonProcess.stdout?.on("data", (data: Buffer) => {
        this.buffer += data.toString();
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const message: JsonRpcResponse | JsonRpcNotification =
              JSON.parse(line);

            // Handle ready notification
            if ("method" in message && message.method === "ready") {
              logger.info("Python embeddings service is ready");
              this.isReady = true;
              resolve();
              continue;
            }

            // Handle response
            if ("id" in message && message.id !== null) {
              const pending = this.pendingRequests.get(message.id);
              if (pending) {
                // Clear the timeout
                if (pending.timeoutId) {
                  clearTimeout(pending.timeoutId);
                }
                this.pendingRequests.delete(message.id);
                if (message.error) {
                  pending.reject(new Error(message.error.message));
                } else {
                  pending.resolve(message.result);
                }
              }
            }
          } catch (error) {
            logger.error("Failed to parse Python response:", error);
          }
        }
      });

      // Handle stderr (logs and errors)
      this.pythonProcess.stderr?.on("data", (data: Buffer) => {
        const message = data.toString();

        // Filter out harmless warnings and debug messages
        if (
          message.includes("UserWarning: Core Pydantic V1") ||
          message.includes("from pydantic.v1.fields import") ||
          message.includes("UserWarning: Found nvidia/llama") ||
          message.includes("but type is unknown") ||
          message.includes("warnings.warn") ||
          message.startsWith("DEBUG:")
        ) {
          // Suppress these common warnings - they don't affect functionality
          return;
        }

        // Only log actual errors
        if (
          message.includes("Error") ||
          message.includes("Exception") ||
          message.includes("Traceback")
        ) {
          logger.error("Python service error:", message);
        }
      });

      // Handle process exit
      this.pythonProcess.on("exit", (code) => {
        logger.warn(`Python service exited with code ${code}`);
        this.isReady = false;
        this.pythonProcess = null;

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests.entries()) {
          pending.reject(new Error("Python service terminated"));
          this.pendingRequests.delete(id);
        }

        if (!this.isReady) {
          reject(
            new Error(`Python service failed to start (exit code ${code})`)
          );
        }
      });

      // Timeout if service doesn't start
      const initTimeout = setTimeout(() => {
        if (!this.isReady) {
          logger.error("Python service initialization timeout after 30s");
          this.cleanup();
          reject(new Error("Python service initialization timeout"));
        }
      }, 30000); // 30 second timeout

      // Clear timeout on successful initialization
      this.pythonProcess.stdout?.once("data", () => {
        if (this.isReady) {
          clearTimeout(initTimeout);
        }
      });
    });

    return this.initPromise;
  }

  /**
   * Send JSON-RPC request to Python service
   */
  private async sendRequest(
    method: string,
    params?: Record<string, any>
  ): Promise<any> {
    if (!this.isReady) {
      await this.initialize();
    }

    // If still not ready after initialization, throw error
    if (!this.isReady || !this.pythonProcess) {
      throw new Error("Python service not available");
    }

    if (!this.pythonProcess || !this.pythonProcess.stdin) {
      throw new Error("Python service is not available");
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        method,
        params,
        id,
      };

      // Request timeout
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          logger.error(`Request timeout for ${method} after 90s`);
          // Don't cleanup the whole service for a single timeout
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 90000); // 90 second timeout for large batches

      this.pendingRequests.set(id, { resolve, reject, timeoutId });

      const requestStr = JSON.stringify(request) + "\n";
      this.pythonProcess!.stdin!.write(requestStr, (error) => {
        if (error) {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(id);
          reject(error);
        }
      });
    });
  }

  /**
   * Embed documents (passages) for storage in vector database
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      logger.warn("embedDocuments called with empty array");
      return [];
    }

    logger.debug(`Embedding ${texts.length} documents as passages`);

    const embeddings: number[][] = [];
    const total = texts.length;

    try {
      for (let start = 0; start < total; start += MAX_EMBED_BATCH) {
        const batch = texts.slice(start, start + MAX_EMBED_BATCH);
        const batchResult = await this.sendRequest("embed_documents", {
          documents: batch,
          batchSize: batch.length,
        });

        if (
          !batchResult?.embeddings ||
          batchResult.embeddings.length !== batch.length
        ) {
          throw new Error(
            `Embedding batch size mismatch. Expected ${batch.length}, received ${batchResult?.embeddings?.length ?? 0}`
          );
        }

        embeddings.push(...batchResult.embeddings);

        logger.debug(
          `Embedded ${Math.min(start + batch.length, total)}/${total} chunks`
        );
      }

      logger.info(
        `Successfully embedded ${embeddings.length} documents (${embeddings[0]?.length ?? 0}D)`
      );
      return embeddings;
    } catch (error) {
      logger.error("Failed to embed documents:", error);
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

    logger.debug(`Embedding query: ${text.substring(0, 50)}...`);

    try {
      const result = await this.sendRequest("embed_query", {
        query: text,
      });

      logger.debug(
        `Query embedded successfully (${result.dimensions} dimensions)`
      );
      return result.embedding;
    } catch (error) {
      logger.error("Failed to embed query:", error);
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
    try {
      return await this.sendRequest("get_model_info");
    } catch (error) {
      logger.error("Failed to get model info:", error);
      throw error;
    }
  }

  /**
   * Clean up Python process
   */
  cleanup(): void {
    if (this.pythonProcess) {
      logger.info("Shutting down Python embeddings service");
      try {
        // Send shutdown command if possible
        if (this.pythonProcess.stdin && !this.pythonProcess.stdin.destroyed) {
          this.pythonProcess.stdin.end();
        }

        // Kill the process
        this.pythonProcess.kill("SIGTERM");

        // Force kill after 2 seconds if still running
        setTimeout(() => {
          if (this.pythonProcess && !this.pythonProcess.killed) {
            logger.warn("Force killing Python service");
            this.pythonProcess.kill("SIGKILL");
          }
        }, 2000);
      } catch (error) {
        logger.error("Error during Python service cleanup:", error);
      } finally {
        this.pythonProcess = null;
        this.isReady = false;
        this.initPromise = null;
        this.pendingRequests.clear();
      }
    }
  }
}

/**
 * Factory function to create NVIDIA Embeddings instance
 * Uses official Python langchain-nvidia-ai-endpoints under the hood
 *
 * @returns Configured NVIDIA embeddings instance
 */
export function createNVIDIAEmbeddings(): NvidiaEmbeddings {
  logger.info("Creating NVIDIA Embeddings client (Python bridge)");
  return new NvidiaEmbeddings();
}

/**
 * Default configuration for NVIDIA embeddings
 * Useful for debugging and configuration reference
 */
export const nvidiaEmbeddingDefaults = {
  modelName: NVIDIA_EMBED_MODEL,
  provider: "NVIDIA",
  type: "retrieval-embeddings",
  apiEndpoint: "https://integrate.api.nvidia.com/v1",
};
