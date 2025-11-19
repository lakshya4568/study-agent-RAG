/**
 * Logger utility using Winston
 */

import * as winston from "winston";

// Suppress deprecation warnings (e.g., punycode)
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  // Only show critical warnings, suppress deprecations
  if (warning.name !== "DeprecationWarning") {
    console.warn(warning.name, warning.message);
  }
});

// Create Winston logger with only console transport initially
// File transports are added later when app is ready
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "study-agent-mcp-client" },
  transports: [
    // Single console transport with formatted output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          // Only show metadata if it's not the default service tag
          const { service, ...otherMeta } = metadata;
          if (Object.keys(otherMeta).length > 0) {
            msg += ` ${JSON.stringify(otherMeta)}`;
          }
          return msg;
        })
      ),
    }),
  ],
});

// Initialize file logging when Electron app is ready
let fileLoggingInitialized = false;

export const initializeFileLogging = async (): Promise<void> => {
  if (fileLoggingInitialized) return;

  try {
    const { app } = await import("electron");
    const path = await import("path");

    // Wait for app to be ready
    if (!app.isReady()) {
      await app.whenReady();
    }

    const userDataPath = app.getPath("userData");
    const logsDir = path.join(userDataPath, "logs");

    // Add file transports
    logger.add(
      new winston.transports.File({
        filename: path.join(logsDir, "error.log"),
        level: "error",
      })
    );

    logger.add(
      new winston.transports.File({
        filename: path.join(logsDir, "combined.log"),
      })
    );

    fileLoggingInitialized = true;
    logger.info("File logging initialized", { logsDir });
  } catch (error) {
    // Silently fail if we can't initialize file logging
    console.warn("Could not initialize file logging:", error);
  }
};

export default logger;
