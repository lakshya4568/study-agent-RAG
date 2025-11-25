/**
 * ConfigManager - Handles loading and accessing configuration
 */

import * as dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { IConfigManager, ConfigSummaryItem } from "./types";

const SECRET_KEYS = new Set([
  "NVIDIA_API_KEY",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
]);

const KNOWN_KEYS: Array<{ key: string; description?: string }> = [
  {
    key: "NVIDIA_API_KEY",
    description: "Required for NVIDIA NIM chat + embeddings",
  },
  {
    key: "GEMINI_API_KEY",
    description: "Optional Gemini provider for experimentation",
  },
  {
    key: "ANTHROPIC_API_KEY",
    description: "Optional Anthropic fallback",
  },
  {
    key: "MCP_SERVER_PATH",
    description: "Default MCP server entry point (absolute path)",
  },
  {
    key: "MCP_SERVER_COMMAND",
    description: "Executable used to launch MCP server",
  },
];

export class ConfigManager implements IConfigManager {
  private config: Record<string, unknown> = {};
  private readonly envPath: string;

  constructor(envPath?: string) {
    // Try multiple locations for .env file
    let resolvedEnvPath = envPath;

    if (!resolvedEnvPath) {
      // 1. Try bundled .env in resources (packaged app)
      const bundledEnv = path.join(process.resourcesPath || "", ".env");

      // 2. Try current working directory (development)
      const cwdEnv = path.resolve(process.cwd(), ".env");

      resolvedEnvPath = fs.existsSync(bundledEnv) ? bundledEnv : cwdEnv;
    }

    this.envPath = resolvedEnvPath;

    if (fs.existsSync(this.envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(this.envPath));
      this.config = { ...parsed };
    }

    dotenv.config({ path: this.envPath });

    // Ensure runtime process.env values are reflected in the in-memory cache
    for (const key of Object.keys(process.env)) {
      if (process.env[key] !== undefined) {
        this.config[key] = process.env[key] as string;
      }
    }
  }

  /**
   * Get a configuration value by key
   */
  get<T>(key: string): T | undefined {
    return this.config[key] as T | undefined;
  }

  /**
   * Set a configuration value
   */
  set<T>(key: string, value: T): void {
    this.config[key] = value;
  }

  /**
   * Get all configuration
   */
  getAll(): Record<string, unknown> {
    return { ...this.config };
  }

  /**
   * Return human-friendly summary of the current configuration without leaking secrets
   */
  getSummary(): ConfigSummaryItem[] {
    const keys = new Set([
      ...KNOWN_KEYS.map((entry) => entry.key),
      ...Object.keys(this.config),
    ]);

    return Array.from(keys).map((key) => {
      const value = this.config[key];
      const isSecret = SECRET_KEYS.has(key);
      const description = KNOWN_KEYS.find(
        (entry) => entry.key === key
      )?.description;

      return {
        key,
        description,
        isSecret,
        isSet: Boolean(value),
        value: !isSecret ? (value as string | undefined) : undefined,
        maskedValue: isSecret
          ? this.maskValue(value as string | undefined)
          : undefined,
      } satisfies ConfigSummaryItem;
    });
  }

  /**
   * Update configuration values and persist to the .env file
   */
  async update(values: Record<string, string | undefined>): Promise<void> {
    let mutated = false;

    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null || value === "") {
        if (key in this.config) {
          delete this.config[key];
          delete process.env[key];
          mutated = true;
        }
        continue;
      }

      if (this.config[key] !== value) {
        this.config[key] = value;
        process.env[key] = value;
        mutated = true;
      }
    }

    if (mutated) {
      await fs.promises.writeFile(this.envPath, this.serializeConfig(), {
        encoding: "utf-8",
      });
    }
  }

  getEnvPath(): string {
    return this.envPath;
  }

  /**
   * Validate that required configuration is present
   */
  validate(requiredKeys: string[]): boolean {
    for (const key of requiredKeys) {
      if (!this.config[key]) {
        console.warn(`Missing required configuration: ${key}`);
        return false;
      }
    }
    return true;
  }

  private maskValue(value?: string): string | undefined {
    if (!value) return undefined;
    if (value.length <= 4) {
      return "*".repeat(value.length);
    }
    const start = value.slice(0, 4);
    const end = value.slice(-4);
    return `${start}****${end}`;
  }

  private serializeConfig(): string {
    return Object.entries(this.config)
      .map(([key, rawValue]) => {
        const value = rawValue ?? "";
        const sanitized = String(value).replace(/\n/g, "\\n");
        return `${key}=${sanitized}`;
      })
      .join("\n");
  }
}
