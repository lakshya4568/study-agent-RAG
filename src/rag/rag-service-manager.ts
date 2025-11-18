/**
 * RAG Service Manager
 *
 * Manages the lifecycle of the Python FastAPI RAG service.
 * Handles starting, stopping, and monitoring the service process.
 */

import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { app } from "electron";
import { logger } from "../client/logger";
import { ragClient } from "./rag-client";

let ragServiceProcess: ChildProcess | null = null;
const DEFAULT_RAG_PORT = 9000;
const STARTUP_TIMEOUT_MS = 30000; // 30 seconds
const HEALTH_CHECK_INTERVAL_MS = 2000; // 2 seconds

function getRAGPort(): number {
  const raw = process.env.RAG_PORT?.trim();
  if (!raw) {
    return DEFAULT_RAG_PORT;
  }
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_RAG_PORT;
}

function getPythonExecutable(): string {
  // Try to find Python in project's virtual environment first
  const venvPaths = [
    path.join(process.cwd(), ".venv", "bin", "python"),
    path.join(process.cwd(), ".venv", "Scripts", "python.exe"), // Windows
    path.join(process.cwd(), "python", ".venv", "bin", "python"),
    path.join(process.cwd(), "python", ".venv", "Scripts", "python.exe"),
  ];

  for (const venvPath of venvPaths) {
    try {
      if (existsSync(venvPath)) {
        logger.info(`Found Python venv: ${venvPath}`);
        return venvPath;
      }
    } catch {
      // Continue to next path
    }
  }

  // Fallback to system Python
  logger.warn("No venv found, using system Python");
  return process.platform === "win32" ? "python" : "python3";
}

function getRagServicePath(): string {
  return path.join(process.cwd(), "python", "nvidia_rag_service.py");
}

function getChromaPersistDir(): string {
  // Use app's userData directory for persistent storage
  if (process.env.CHROMA_PERSIST_DIR) {
    return path.resolve(process.env.CHROMA_PERSIST_DIR);
  }

  try {
    const userDataPath = app.getPath("userData");
    return path.join(userDataPath, "chroma_db");
  } catch {
    // Fallback for tests or non-Electron environments
    return path.join(process.cwd(), "chroma_db");
  }
}

/**
 * Wait for RAG service to become healthy
 */
async function waitForHealthy(timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const isHealthy = await ragClient.testConnection();
      if (isHealthy) {
        return true;
      }
    } catch {
      // Service not ready yet
    }

    // Wait before next check
    await new Promise((resolve) =>
      setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS)
    );
  }

  return false;
}

/**
 * Start the Python RAG service
 */
export async function startRAGService(): Promise<void> {
  if (ragServiceProcess) {
    logger.warn("RAG service already running");
    return;
  }

  try {
    const pythonExec = getPythonExecutable();
    const servicePath = getRagServicePath();
    const port = getRAGPort();
    const persistDir = getChromaPersistDir();

    logger.info("=".repeat(60));
    logger.info("Starting NVIDIA RAG Service");
    logger.info("=".repeat(60));
    logger.info(`Python: ${pythonExec}`);
    logger.info(`Service: ${servicePath}`);
    logger.info(`Port: ${port}`);
    logger.info(`Persist Dir: ${persistDir}`);
    logger.info("=".repeat(60));

    // Ensure NVIDIA API key is set
    if (!process.env.NVIDIA_API_KEY) {
      throw new Error("NVIDIA_API_KEY environment variable is required");
    }

    // Set environment variables for the Python service
    const env = {
      ...process.env,
      NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
      CHROMA_PERSIST_DIR: persistDir,
      PYTHONUNBUFFERED: "1", // Ensure immediate stdout/stderr output
    };

    // Start the service
    ragServiceProcess = spawn(
      pythonExec,
      [
        servicePath,
        // Could add uvicorn args here if needed
      ],
      {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      }
    );

    // Log stdout
    ragServiceProcess.stdout?.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        logger.info(`[RAG Service] ${output}`);
      }
    });

    // Log stderr (Python uses stderr for info logs too)
    ragServiceProcess.stderr?.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        logger.info(`[RAG Service] ${output}`);
      }
    });

    // Handle process exit
    ragServiceProcess.on("exit", (code, signal) => {
      if (code !== null) {
        logger.info(`RAG service exited with code ${code}`);
      } else if (signal !== null) {
        logger.info(`RAG service killed by signal ${signal}`);
      }
      ragServiceProcess = null;
    });

    // Handle process errors
    ragServiceProcess.on("error", (error) => {
      logger.error(`RAG service error: ${error.message}`);
      ragServiceProcess = null;
    });

    // Wait for service to become healthy
    logger.info("Waiting for RAG service to become healthy...");
    const isHealthy = await waitForHealthy(STARTUP_TIMEOUT_MS);

    if (!isHealthy) {
      throw new Error(
        `RAG service failed to start within ${STARTUP_TIMEOUT_MS / 1000} seconds`
      );
    }

    // Verify service details
    const health = await ragClient.healthCheck();
    logger.info("✓ RAG service is healthy");
    logger.info(`  - Collection: ${health.collection_name}`);
    logger.info(`  - Embedding Model: ${health.embedding_model}`);
    logger.info(`  - LLM Model: ${health.llm_model}`);
    logger.info(`  - Persist Dir: ${health.persist_dir}`);
  } catch (error) {
    logger.error(`Failed to start RAG service: ${error}`);

    // Clean up on failure
    if (ragServiceProcess) {
      ragServiceProcess.kill();
      ragServiceProcess = null;
    }

    throw error;
  }
}

/**
 * Stop the Python RAG service
 */
export async function stopRAGService(): Promise<void> {
  if (!ragServiceProcess) {
    logger.info("RAG service not running");
    return;
  }

  return new Promise<void>((resolve) => {
    if (!ragServiceProcess) {
      resolve();
      return;
    }

    logger.info("Stopping RAG service...");

    // Set a timeout in case the process doesn't stop gracefully
    const killTimeout = setTimeout(() => {
      if (ragServiceProcess) {
        logger.warn("RAG service did not stop gracefully, forcing kill");
        ragServiceProcess.kill("SIGKILL");
      }
    }, 5000);

    ragServiceProcess.once("exit", () => {
      clearTimeout(killTimeout);
      ragServiceProcess = null;
      logger.info("✓ RAG service stopped");
      resolve();
    });

    // Try graceful shutdown first
    ragServiceProcess.kill("SIGTERM");
  });
}

/**
 * Check if RAG service is running
 */
export function isRAGServiceRunning(): boolean {
  return ragServiceProcess !== null && !ragServiceProcess.killed;
}

/**
 * Get RAG service status
 */
export async function getRAGServiceStatus(): Promise<{
  running: boolean;
  healthy: boolean;
  stats?: {
    collection_name: string;
    document_count: number;
  };
}> {
  const running = isRAGServiceRunning();

  if (!running) {
    return { running: false, healthy: false };
  }

  try {
    const healthy = await ragClient.testConnection();

    if (healthy) {
      const stats = await ragClient.getCollectionStats();
      return {
        running: true,
        healthy: true,
        stats: {
          collection_name: stats.collection_name,
          document_count: stats.document_count,
        },
      };
    }

    return { running: true, healthy: false };
  } catch {
    return { running: true, healthy: false };
  }
}
