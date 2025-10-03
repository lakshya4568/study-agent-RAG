/**
 * ConfigManager - Handles loading and accessing configuration
 */

import * as dotenv from 'dotenv';
import { IConfigManager } from './types';

export class ConfigManager implements IConfigManager {
  private config: Record<string, unknown> = {};

  constructor() {
    // Load environment variables from .env file
    dotenv.config();
    
    // Store relevant env vars
    this.config = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      MCP_SERVER_PATH: process.env.MCP_SERVER_PATH,
      MCP_SERVER_COMMAND: process.env.MCP_SERVER_COMMAND,
    };
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
}
