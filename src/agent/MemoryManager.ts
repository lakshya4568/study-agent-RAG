/**
 * MemoryManager — Persistent long-term memory system
 *
 * Manages Memory.md (durable saved memories) and Chat_History_Summary.md
 * (compressed historical context) stored in Electron's userData directory.
 *
 * Memory decisions are LLM-driven: after each conversation turn the model
 * analyses whether any information is memory-worthy and, if so, returns
 * structured updates that are merged into the Markdown files.
 */

import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import { createNVIDIAOpenAIChat } from "../models/nvidia-openai-chat";
import { logger } from "../client/logger";

// ─── Templates ──────────────────────────────────────────────────────────────

const MEMORY_TEMPLATE = `# Memory

## User Profile
- Name: 
- Role: 
- Location: 
- Preferred style: 
- Important traits: 

## Preferences
- Communication preferences: 
- Tooling preferences: 
- Technical preferences: 

## Ongoing Projects

## Long-Term Goals

## Important Context

## Explicit Saved Memories

## Last Updated
- Never updated yet
`;

const CHAT_HISTORY_TEMPLATE = `# Chat History Summary

Compressed, rolling summary of important past conversations.

## Recent Sessions
`;

// ─── LLM Prompt for memory extraction ───────────────────────────────────────

const MEMORY_ANALYSIS_PROMPT = `You are a memory extraction engine for an AI study assistant.

Analyze the latest conversation turn and decide whether any information should be saved to the user's long-term memory.

RULES — what to save:
- User identity, preferences, goals, habits, writing style, tone preferences
- Ongoing projects, deadlines, workflows, tools, tech stack
- Stable personal facts explicitly shared by the user
- Long-term constraints, recurring tasks, important decisions
- Explicit instructions like "remember this" or "save this"

RULES — what NOT to save:
- One-off casual messages with no future value
- Temporary discussion details unlikely to matter later
- Sensitive information unless explicitly allowed
- Duplicated or slightly reworded facts already present in memory
- Raw chat dumps

Current memory contents:
---
{CURRENT_MEMORY}
---

User message: {USER_MESSAGE}

Assistant response: {ASSISTANT_RESPONSE}

Respond with a JSON object ONLY (no markdown, no explanation):
{
  "shouldUpdate": true/false,
  "memoryUpdates": [
    {
      "section": "User Profile" | "Preferences" | "Ongoing Projects" | "Long-Term Goals" | "Important Context" | "Explicit Saved Memories",
      "action": "add" | "update" | "remove",
      "key": "short identifier",
      "value": "the fact to store"
    }
  ],
  "chatSummaryUpdate": "one-sentence summary of this conversation turn, or null if trivial"
}

If nothing is memory-worthy, return: { "shouldUpdate": false, "memoryUpdates": [], "chatSummaryUpdate": null }`;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MemoryUpdate {
  section: string;
  action: "add" | "update" | "remove";
  key: string;
  value: string;
}

export interface MemoryAnalysisResult {
  shouldUpdate: boolean;
  memoryUpdates: MemoryUpdate[];
  chatSummaryUpdate: string | null;
}

export interface MemoryStatus {
  memoryFileExists: boolean;
  chatHistoryFileExists: boolean;
  memoryFileSizeBytes: number;
  chatHistoryFileSizeBytes: number;
  lastUpdated: string | null;
  temporaryMode: boolean;
  memoryDir: string;
}

// ─── MemoryManager ──────────────────────────────────────────────────────────

export class MemoryManager {
  private memoryDir: string;
  private memoryPath: string;
  private chatHistoryPath: string;
  private logsDir: string;
  private temporaryMode = false;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.memoryDir = path.join(userDataPath, "memory");
    this.memoryPath = path.join(this.memoryDir, "Memory.md");
    this.chatHistoryPath = path.join(this.memoryDir, "Chat_History_Summary.md");
    this.logsDir = path.join(this.memoryDir, "logs");
  }

  // ── Initialization ──────────────────────────────────────────────────────

  /** Ensure the memory directory and default files exist. */
  initialize(): void {
    try {
      // Create directories
      if (!fs.existsSync(this.memoryDir)) {
        fs.mkdirSync(this.memoryDir, { recursive: true });
        logger.info(`Created memory directory: ${this.memoryDir}`);
      }
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }

      // Scaffold default files
      if (!fs.existsSync(this.memoryPath)) {
        fs.writeFileSync(this.memoryPath, MEMORY_TEMPLATE, "utf-8");
        logger.info("Created default Memory.md");
      }
      if (!fs.existsSync(this.chatHistoryPath)) {
        fs.writeFileSync(this.chatHistoryPath, CHAT_HISTORY_TEMPLATE, "utf-8");
        logger.info("Created default Chat_History_Summary.md");
      }
    } catch (error) {
      logger.error("Failed to initialize MemoryManager:", error);
    }
  }

  // ── Read ────────────────────────────────────────────────────────────────

  /** Load the full contents of Memory.md */
  loadMemory(): string {
    try {
      if (fs.existsSync(this.memoryPath)) {
        return fs.readFileSync(this.memoryPath, "utf-8");
      }
    } catch (error) {
      logger.error("Failed to read Memory.md:", error);
    }
    return "";
  }

  /** Load the full contents of Chat_History_Summary.md */
  loadChatHistory(): string {
    try {
      if (fs.existsSync(this.chatHistoryPath)) {
        return fs.readFileSync(this.chatHistoryPath, "utf-8");
      }
    } catch (error) {
      logger.error("Failed to read Chat_History_Summary.md:", error);
    }
    return "";
  }

  /**
   * Build a concise context string suitable for system-prompt injection.
   * Combines Memory.md and the latest Chat_History_Summary.md entries.
   */
  getMemoryForPrompt(): string {
    const memory = this.loadMemory();
    const chatHistory = this.loadChatHistory();

    if (!memory && !chatHistory) {
      return "";
    }

    const parts: string[] = [];

    if (memory) {
      parts.push("=== Long-Term Memory ===\n" + memory.trim());
    }
    if (chatHistory) {
      // Only include the most recent ~2000 chars of chat history to stay compact
      const trimmed =
        chatHistory.length > 2000
          ? "...\n" + chatHistory.slice(-2000)
          : chatHistory;
      parts.push("=== Recent Conversation History ===\n" + trimmed.trim());
    }

    return parts.join("\n\n");
  }

  // ── Write — LLM-driven analysis ────────────────────────────────────────

  /**
   * Analyze a conversation turn and update memory files if warranted.
   * This method is designed to be called fire-and-forget (don't block
   * the response stream).
   */
  async analyzeAndUpdate(
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    if (this.temporaryMode) {
      logger.info("[Memory] Temporary mode active — skipping memory update");
      return;
    }

    try {
      const currentMemory = this.loadMemory();

      const prompt = MEMORY_ANALYSIS_PROMPT.replace(
        "{CURRENT_MEMORY}",
        currentMemory || "(empty)"
      )
        .replace("{USER_MESSAGE}", userMessage)
        .replace("{ASSISTANT_RESPONSE}", assistantResponse);

      const model = createNVIDIAOpenAIChat({ temperature: 0.1, maxTokens: 1000 });
      const raw = await model.invoke([{ role: "user", content: prompt }]);

      // Parse the JSON response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn("[Memory] LLM did not return valid JSON for memory analysis");
        return;
      }

      const analysis: MemoryAnalysisResult = JSON.parse(jsonMatch[0]);

      if (!analysis.shouldUpdate) {
        logger.info("[Memory] No memory update needed for this turn");
        return;
      }

      // Apply memory updates
      if (analysis.memoryUpdates.length > 0) {
        this.applyMemoryUpdates(analysis.memoryUpdates);
        logger.info(
          `[Memory] Applied ${analysis.memoryUpdates.length} update(s) to Memory.md`
        );
      }

      // Append to chat history summary
      if (analysis.chatSummaryUpdate) {
        this.appendChatSummary(analysis.chatSummaryUpdate);
        logger.info("[Memory] Updated Chat_History_Summary.md");
      }
    } catch (error) {
      logger.error("[Memory] Failed to analyze/update memory:", error);
    }
  }

  // ── Write helpers ─────────────────────────────────────────────────────

  /** Apply structured updates to Memory.md sections. */
  private applyMemoryUpdates(updates: MemoryUpdate[]): void {
    let content = this.loadMemory();

    for (const update of updates) {
      const sectionHeader = `## ${update.section}`;
      const sectionIdx = content.indexOf(sectionHeader);

      if (sectionIdx === -1) {
        // Section doesn't exist — append before "## Last Updated"
        const lastUpdatedIdx = content.indexOf("## Last Updated");
        const insertPoint =
          lastUpdatedIdx !== -1 ? lastUpdatedIdx : content.length;
        content =
          content.slice(0, insertPoint) +
          `${sectionHeader}\n- ${update.key}: ${update.value}\n\n` +
          content.slice(insertPoint);
        continue;
      }

      // Find the section boundary (next ## or end of file)
      const nextSectionMatch = content
        .slice(sectionIdx + sectionHeader.length)
        .match(/\n## /);
      const sectionEnd = nextSectionMatch
        ? sectionIdx +
          sectionHeader.length +
          (nextSectionMatch.index as number)
        : content.length;

      const sectionContent = content.slice(
        sectionIdx + sectionHeader.length,
        sectionEnd
      );

      if (update.action === "add") {
        // Check for duplicate (case-insensitive key match)
        const keyPattern = new RegExp(
          `^- ${this.escapeRegex(update.key)}:`,
          "im"
        );
        if (keyPattern.test(sectionContent)) {
          // Update existing entry instead of duplicating
          const updatedSection = sectionContent.replace(
            keyPattern,
            `- ${update.key}: ${update.value}`
          );
          content =
            content.slice(0, sectionIdx + sectionHeader.length) +
            updatedSection +
            content.slice(sectionEnd);
        } else {
          // Append new entry at the end of section
          const entry = `- ${update.key}: ${update.value}\n`;
          content =
            content.slice(0, sectionEnd) + entry + content.slice(sectionEnd);
        }
      } else if (update.action === "update") {
        const keyPattern = new RegExp(
          `^- ${this.escapeRegex(update.key)}:.*$`,
          "im"
        );
        if (keyPattern.test(sectionContent)) {
          const updatedSection = sectionContent.replace(
            keyPattern,
            `- ${update.key}: ${update.value}`
          );
          content =
            content.slice(0, sectionIdx + sectionHeader.length) +
            updatedSection +
            content.slice(sectionEnd);
        } else {
          // Key not found — add it
          const entry = `- ${update.key}: ${update.value}\n`;
          content =
            content.slice(0, sectionEnd) + entry + content.slice(sectionEnd);
        }
      } else if (update.action === "remove") {
        const keyPattern = new RegExp(
          `^- ${this.escapeRegex(update.key)}:.*\\n?`,
          "im"
        );
        const updatedSection = sectionContent.replace(keyPattern, "");
        content =
          content.slice(0, sectionIdx + sectionHeader.length) +
          updatedSection +
          content.slice(sectionEnd);
      }
    }

    // Update the "Last Updated" timestamp
    const timestamp = new Date().toISOString();
    content = content.replace(
      /## Last Updated[\s\S]*$/,
      `## Last Updated\n- ${timestamp}\n`
    );

    fs.writeFileSync(this.memoryPath, content, "utf-8");
  }

  /** Append a summary line to Chat_History_Summary.md */
  private appendChatSummary(summary: string): void {
    let content = this.loadChatHistory();
    const date = new Date().toISOString().split("T")[0];
    const entry = `- **${date}**: ${summary}\n`;

    // Insert under "## Recent Sessions"
    const recentIdx = content.indexOf("## Recent Sessions");
    if (recentIdx !== -1) {
      const insertPoint =
        recentIdx + "## Recent Sessions".length + 1; // +1 for newline
      content =
        content.slice(0, insertPoint) + entry + content.slice(insertPoint);
    } else {
      content += `\n## Recent Sessions\n${entry}`;
    }

    // Keep the file manageable — cap at ~100 entries
    const lines = content.split("\n");
    const entryLines = lines.filter((l) => l.startsWith("- **"));
    if (entryLines.length > 100) {
      // Remove the oldest entries (they're at the bottom after the header)
      const excess = entryLines.length - 100;
      let removed = 0;
      const filtered = lines.filter((l) => {
        if (removed >= excess) return true;
        if (l.startsWith("- **")) {
          // Check if this is one of the oldest (last) entries
          const idx = entryLines.indexOf(l);
          if (idx >= entryLines.length - excess) {
            removed++;
            return false;
          }
        }
        return true;
      });
      content = filtered.join("\n");
    }

    fs.writeFileSync(this.chatHistoryPath, content, "utf-8");
  }

  // ── Explicit memory commands ──────────────────────────────────────────

  /**
   * Handle explicit user memory commands.
   * Returns a human-readable response string for the agent to relay.
   */
  executeMemoryCommand(
    command: "remember" | "forget" | "recall" | "temporary_mode",
    args?: string
  ): string {
    switch (command) {
      case "remember": {
        if (!args) return "What would you like me to remember?";
        this.applyMemoryUpdates([
          {
            section: "Explicit Saved Memories",
            action: "add",
            key: args.slice(0, 60).replace(/[:\n]/g, " "),
            value: args,
          },
        ]);
        return `✅ Saved to memory: "${args}"`;
      }

      case "forget": {
        if (!args) return "What would you like me to forget?";
        // Search all sections for a matching entry and remove
        const content = this.loadMemory();
        const regex = new RegExp(`^- .*${this.escapeRegex(args)}.*$`, "gim");
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
          let updated = content;
          for (const match of matches) {
            updated = updated.replace(match + "\n", "");
          }
          // Update timestamp
          const timestamp = new Date().toISOString();
          updated = updated.replace(
            /## Last Updated[\s\S]*$/,
            `## Last Updated\n- ${timestamp}\n`
          );
          fs.writeFileSync(this.memoryPath, updated, "utf-8");
          return `🗑️ Removed ${matches.length} memory entry(ies) matching "${args}"`;
        }
        return `No memory entries found matching "${args}"`;
      }

      case "recall": {
        const memory = this.loadMemory();
        if (!memory || memory.trim() === MEMORY_TEMPLATE.trim()) {
          return "I don't have any saved memories about you yet.";
        }
        return memory;
      }

      case "temporary_mode": {
        this.temporaryMode = !this.temporaryMode;
        return this.temporaryMode
          ? "🔒 Temporary chat mode enabled — I won't save any memories from this point."
          : "🔓 Temporary chat mode disabled — memory saving resumed.";
      }

      default:
        return "Unknown memory command.";
    }
  }

  /** Explicitly set temporary mode on/off */
  setTemporaryMode(enabled: boolean): void {
    this.temporaryMode = enabled;
    logger.info(`[Memory] Temporary mode ${enabled ? "enabled" : "disabled"}`);
  }

  /** Check if temporary mode is active */
  isTemporaryMode(): boolean {
    return this.temporaryMode;
  }

  // ── Status ────────────────────────────────────────────────────────────

  getStatus(): MemoryStatus {
    let memorySize = 0;
    let chatSize = 0;
    let lastUpdated: string | null = null;

    try {
      if (fs.existsSync(this.memoryPath)) {
        memorySize = fs.statSync(this.memoryPath).size;
        // Extract timestamp from file
        const content = fs.readFileSync(this.memoryPath, "utf-8");
        const tsMatch = content.match(
          /## Last Updated\n- (.+)/
        );
        if (tsMatch && tsMatch[1] !== "Never updated yet") {
          lastUpdated = tsMatch[1];
        }
      }
      if (fs.existsSync(this.chatHistoryPath)) {
        chatSize = fs.statSync(this.chatHistoryPath).size;
      }
    } catch (error) {
      logger.error("[Memory] Failed to get status:", error);
    }

    return {
      memoryFileExists: fs.existsSync(this.memoryPath),
      chatHistoryFileExists: fs.existsSync(this.chatHistoryPath),
      memoryFileSizeBytes: memorySize,
      chatHistoryFileSizeBytes: chatSize,
      lastUpdated,
      temporaryMode: this.temporaryMode,
      memoryDir: this.memoryDir,
    };
  }

  // ── Utilities ─────────────────────────────────────────────────────────

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
