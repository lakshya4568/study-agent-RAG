/**
 * ChromaDB Server Management for Persistent Storage
 *
 * This module manages a local ChromaDB HTTP server for persistent vector storage.
 * The server runs on localhost:8000 and stores data in the app's userData directory.
 *
 * Usage:
 * - Call startChromaServer() during app initialization
 * - Call stopChromaServer() during app shutdown
 * - Server persists embeddings across application restarts
 */

import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../client/logger";

let chromaServerProcess: ChildProcess | null = null;
const DEFAULT_CHROMA_HOST = "localhost";
const DEFAULT_CHROMA_PORT = 8000;

function getChromaHost(): string {
  return process.env.CHROMA_HOST?.trim() || DEFAULT_CHROMA_HOST;
}

function getChromaPort(): number {
  const raw = process.env.CHROMA_PORT?.trim();
  if (!raw) {
    return DEFAULT_CHROMA_PORT;
  }
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_CHROMA_PORT;
}

// Lazy-initialized storage path for ChromaDB
// This is computed on first access to avoid issues in test environments
let _chromaPersistDir: string | null = null;

/**
 * Get the ChromaDB persistent storage directory
 * Falls back to ./chroma_storage if Electron app is not available (e.g., in tests)
 */
export function getChromaPersistDir(): string {
  if (_chromaPersistDir) {
    return _chromaPersistDir;
  }

  try {
    // Try to use Electron's userData path if available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require("electron");
    _chromaPersistDir = path.join(app.getPath("userData"), "chroma_storage");
  } catch {
    // Fallback for non-Electron environments (tests, scripts)
    _chromaPersistDir = path.join(process.cwd(), ".chromadb", "chroma_storage");
    logger.warn(
      `Electron app not available, using fallback storage: ${_chromaPersistDir}`
    );
  }

  return _chromaPersistDir;
}

// Legacy export for backward compatibility
export const CHROMA_PERSIST_DIR = getChromaPersistDir();

/**
 * Check if ChromaDB server is running
 */
export async function isChromaServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(
      `http://${getChromaHost()}:${getChromaPort()}/api/v2/heartbeat`
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start the ChromaDB HTTP server as a subprocess
 * Server will persist data to CHROMA_PERSIST_DIR
 *
 * @returns Promise that resolves when server is ready
 */
export async function startChromaServer(
  startupTimeoutMs = 10000
): Promise<void> {
  // Check if already running
  const isRunning = await isChromaServerRunning();
  if (isRunning) {
    logger.info("✅ ChromaDB server already running");
    return;
  }

  const persistDir = getChromaPersistDir();

  // Ensure storage directory exists
  if (!fs.existsSync(persistDir)) {
    fs.mkdirSync(persistDir, { recursive: true });
    logger.info(`📁 Created ChromaDB storage directory: ${persistDir}`);
  }

  return new Promise((resolve, reject) => {
    const persistDir = getChromaPersistDir();
    const host = getChromaHost();
    const port = getChromaPort();
    logger.info("🚀 Starting ChromaDB server...");
    logger.info(`   Port: ${port}`);
    logger.info(`   Storage: ${persistDir}`);
    console.log(
      `[ChromaDB] Starting local server at http://${host}:${port} (storage: ${persistDir})`
    );

    // Determine chroma CLI path - prefer venv, fallback to system
    const venvChroma = path.join(process.cwd(), ".venv", "bin", "chroma");
    const chromaCmd = fs.existsSync(venvChroma) ? venvChroma : "chroma";

    logger.info(`   Using: ${chromaCmd}`);

    // Start ChromaDB server
    chromaServerProcess = spawn(
      chromaCmd,
      ["run", "--path", persistDir, "--port", port.toString(), "--host", host],
      {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      }
    );

    let serverStarted = false;

    // Handle server output
    chromaServerProcess.stdout?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      logger.debug(`[ChromaDB] ${message}`);

      // Detect when server is ready
      if (
        message.includes("Application startup complete") ||
        message.includes("Uvicorn running")
      ) {
        if (!serverStarted) {
          serverStarted = true;
          logger.info(`✅ ChromaDB server ready at http://${host}:${port}`);
          resolve();
        }
      }
    });

    chromaServerProcess.stderr?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      // Filter out common non-error messages
      if (
        !message.includes("WARNING") &&
        !message.includes("Started server process")
      ) {
        logger.warn(`[ChromaDB] ${message}`);
      }
    });

    chromaServerProcess.on("error", (error: Error) => {
      logger.error("ChromaDB server failed to start", error);
      if (!serverStarted) {
        reject(
          new Error(
            "Failed to start ChromaDB server. ChromaDB must be installed.\n\n" +
              "Install options:\n" +
              "  1. Using pipx (recommended for macOS):  brew install pipx && pipx install chromadb\n" +
              "  2. Using pip with user flag:  pip3 install --user chromadb\n" +
              "  3. Using pip with break flag:  pip3 install --break-system-packages chromadb\n" +
              "  4. In virtual environment:  python3 -m venv venv && source venv/bin/activate && pip install chromadb\n\n" +
              "Error: " +
              error.message
          )
        );
      }
    });

    chromaServerProcess.on(
      "exit",
      (code: number | null, signal: string | null) => {
        if (code !== 0 && code !== null) {
          logger.error(
            `ChromaDB server exited with code ${code}, signal ${signal}`
          );
          if (!serverStarted) {
            reject(
              new Error(
                `ChromaDB server failed to start (exit code: ${code}). ` +
                  "ChromaDB must be installed.\n\n" +
                  "Install options:\n" +
                  "  1. Using pipx (recommended for macOS):  brew install pipx && pipx install chromadb\n" +
                  "  2. Using pip with user flag:  pip3 install --user chromadb\n" +
                  "  3. Using pip with break flag:  pip3 install --break-system-packages chromadb\n" +
                  "  4. In virtual environment:  python3 -m venv venv && source venv/bin/activate && pip install chromadb"
              )
            );
          }
        }
        chromaServerProcess = null;
      }
    );

    // Timeout if server doesn't start within provided window
    setTimeout(() => {
      if (!serverStarted) {
        logger.error("ChromaDB server startup timeout");
        reject(
          new Error(
            "ChromaDB server startup timeout. Check that ChromaDB is installed and port 8000 is available.\n\n" +
              "Install options:\n" +
              "  1. Using pipx (recommended for macOS):  brew install pipx && pipx install chromadb\n" +
              "  2. Using pip with user flag:  pip3 install --user chromadb\n" +
              "  3. Using pip with break flag:  pip3 install --break-system-packages chromadb\n" +
              "  4. In virtual environment:  python3 -m venv venv && source venv/bin/activate && pip install chromadb"
          )
        );
      }
    }, startupTimeoutMs);
  });
}

/**
 * Stop the ChromaDB server gracefully
 */
export function stopChromaServer(): void {
  if (chromaServerProcess) {
    logger.info("🛑 Stopping ChromaDB server...");
    chromaServerProcess.kill("SIGTERM");
    chromaServerProcess = null;
  }
}

/**
 * Get the ChromaDB server URL
 */
export function getChromaServerUrl(): string {
  return `http://${getChromaHost()}:${getChromaPort()}`;
}

/**
 * Clear all ChromaDB data (useful for testing or reset)
 * WARNING: This will delete all stored embeddings!
 */
export async function clearChromaStorage(): Promise<void> {
  logger.warn("⚠️  Clearing all ChromaDB storage...");

  // Stop server if running
  stopChromaServer();

  // Wait a bit for server to fully stop
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const persistDir = getChromaPersistDir();

  // Delete storage directory
  if (fs.existsSync(persistDir)) {
    fs.rmSync(persistDir, { recursive: true, force: true });
    logger.info("✅ ChromaDB storage cleared");
  }
}
