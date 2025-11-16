/**
 * SQLite Database Manager for Study Agent
 * Handles persistent storage of:
 * - Chat messages and conversations
 * - Uploaded documents metadata
 * - Vector store state
 * - User preferences
 */

import Database from "better-sqlite3";
import path from "node:path";
import { app } from "electron";
import fs from "node:fs";
import { logger } from "../client/logger";

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: string; // JSON string
}

export interface UploadedDocument {
  id: string;
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkCount: number;
  uploadedAt: number;
  status: "processing" | "ready" | "error";
  errorMessage?: string;
}

export interface VectorStoreState {
  id: number;
  totalDocuments: number;
  totalChunks: number;
  lastUpdated: number;
  metadata?: string; // JSON string
}

export interface ConversationThread {
  id: string;
  title: string;
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
}

class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath("userData");
    const dbDir = path.join(userDataPath, "database");

    // Ensure database directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = path.join(dbDir, "study-agent.db");
    logger.info(`Database path: ${this.dbPath}`);
  }

  /**
   * Initialize the database and create tables
   */
  initialize(): void {
    if (this.db) return;

    try {
      this.db = new Database(this.dbPath);
      this.db.pragma("journal_mode = WAL"); // Better concurrency
      this.db.pragma("foreign_keys = ON"); // Enable foreign keys

      this.createTables();
      logger.info("Database initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize database", error);
      throw error;
    }
  }

  /**
   * Create all necessary tables
   */
  private createTables(): void {
    if (!this.db) throw new Error("Database not initialized");

    // Conversation threads table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_message_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0
      )
    `);

    // Chat messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (thread_id) REFERENCES conversation_threads(id) ON DELETE CASCADE
      )
    `);

    // Uploaded documents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS uploaded_documents (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        chunk_count INTEGER DEFAULT 0,
        uploaded_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('processing', 'ready', 'error')),
        error_message TEXT
      )
    `);

    // Vector store state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vector_store_state (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        total_documents INTEGER DEFAULT 0,
        total_chunks INTEGER DEFAULT 0,
        last_updated INTEGER NOT NULL,
        metadata TEXT
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_thread_timestamp 
      ON chat_messages(thread_id, timestamp);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_documents_status 
      ON uploaded_documents(status);
    `);

    // Initialize vector store state if not exists
    const stateCheck = this.db
      .prepare("SELECT COUNT(*) as count FROM vector_store_state")
      .get() as { count: number };

    if (stateCheck.count === 0) {
      this.db
        .prepare(
          `INSERT INTO vector_store_state (id, total_documents, total_chunks, last_updated)
           VALUES (1, 0, 0, ?)`
        )
        .run(Date.now());
    }

    logger.info("Database tables created/verified");
  }

  // ==================== Conversation Threads ====================

  createThread(id: string, title: string): void {
    if (!this.db) throw new Error("Database not initialized");

    const now = Date.now();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO conversation_threads 
         (id, title, created_at, last_message_at, message_count)
         VALUES (?, ?, ?, ?, 0)`
      )
      .run(id, title, now, now);

    logger.info(`Created conversation thread: ${id}`);
  }

  getThread(id: string): ConversationThread | null {
    if (!this.db) throw new Error("Database not initialized");

    const row = this.db
      .prepare(
        `SELECT id, title, created_at as createdAt, last_message_at as lastMessageAt, 
         message_count as messageCount FROM conversation_threads WHERE id = ?`
      )
      .get(id) as ConversationThread | undefined;

    return row || null;
  }

  getAllThreads(): ConversationThread[] {
    if (!this.db) throw new Error("Database not initialized");

    return this.db
      .prepare(
        `SELECT id, title, created_at as createdAt, last_message_at as lastMessageAt,
         message_count as messageCount FROM conversation_threads 
         ORDER BY last_message_at DESC`
      )
      .all() as ConversationThread[];
  }

  deleteThread(id: string): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.prepare("DELETE FROM conversation_threads WHERE id = ?").run(id);
    logger.info(`Deleted conversation thread: ${id}`);
  }

  // ==================== Chat Messages ====================

  saveMessage(message: ChatMessage): void {
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction(() => {
      // Insert message
      this.db!.prepare(
        `INSERT OR REPLACE INTO chat_messages 
         (id, thread_id, role, content, timestamp, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        message.id,
        message.threadId,
        message.role,
        message.content,
        message.timestamp,
        message.metadata || null
      );

      // Update thread's last message time and count
      this.db!.prepare(
        `UPDATE conversation_threads 
         SET last_message_at = ?, 
             message_count = message_count + 1
         WHERE id = ?`
      ).run(message.timestamp, message.threadId);
    });

    transaction();
  }

  getMessages(threadId: string, limit?: number): ChatMessage[] {
    if (!this.db) throw new Error("Database not initialized");

    const query = limit
      ? `SELECT id, thread_id as threadId, role, content, timestamp, metadata 
         FROM chat_messages WHERE thread_id = ? 
         ORDER BY timestamp DESC LIMIT ?`
      : `SELECT id, thread_id as threadId, role, content, timestamp, metadata 
         FROM chat_messages WHERE thread_id = ? 
         ORDER BY timestamp ASC`;

    const params = limit ? [threadId, limit] : [threadId];
    const messages = this.db.prepare(query).all(...params) as ChatMessage[];

    return limit ? messages.reverse() : messages;
  }

  clearMessages(threadId: string): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db
      .prepare("DELETE FROM chat_messages WHERE thread_id = ?")
      .run(threadId);

    this.db
      .prepare("UPDATE conversation_threads SET message_count = 0 WHERE id = ?")
      .run(threadId);

    logger.info(`Cleared messages for thread: ${threadId}`);
  }

  // ==================== Uploaded Documents ====================

  saveDocument(doc: UploadedDocument): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db
      .prepare(
        `INSERT OR REPLACE INTO uploaded_documents 
         (id, file_path, file_name, file_type, file_size, chunk_count, 
          uploaded_at, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        doc.id,
        doc.filePath,
        doc.fileName,
        doc.fileType,
        doc.fileSize,
        doc.chunkCount,
        doc.uploadedAt,
        doc.status,
        doc.errorMessage || null
      );

    logger.info(`Saved document metadata: ${doc.fileName}`);
  }

  getDocument(id: string): UploadedDocument | null {
    if (!this.db) throw new Error("Database not initialized");

    const row = this.db
      .prepare(
        `SELECT id, file_path as filePath, file_name as fileName, 
         file_type as fileType, file_size as fileSize, chunk_count as chunkCount,
         uploaded_at as uploadedAt, status, error_message as errorMessage
         FROM uploaded_documents WHERE id = ?`
      )
      .get(id) as UploadedDocument | undefined;

    return row || null;
  }

  getAllDocuments(): UploadedDocument[] {
    if (!this.db) throw new Error("Database not initialized");

    return this.db
      .prepare(
        `SELECT id, file_path as filePath, file_name as fileName,
         file_type as fileType, file_size as fileSize, chunk_count as chunkCount,
         uploaded_at as uploadedAt, status, error_message as errorMessage
         FROM uploaded_documents ORDER BY uploaded_at DESC`
      )
      .all() as UploadedDocument[];
  }

  getDocumentByPath(filePath: string): UploadedDocument | null {
    if (!this.db) throw new Error("Database not initialized");

    const row = this.db
      .prepare(
        `SELECT id, file_path as filePath, file_name as fileName,
         file_type as fileType, file_size as fileSize, chunk_count as chunkCount,
         uploaded_at as uploadedAt, status, error_message as errorMessage
         FROM uploaded_documents WHERE file_path = ?`
      )
      .get(filePath) as UploadedDocument | undefined;

    return row || null;
  }

  updateDocumentStatus(
    id: string,
    status: "processing" | "ready" | "error",
    errorMessage?: string
  ): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db
      .prepare(
        `UPDATE uploaded_documents 
         SET status = ?, error_message = ? WHERE id = ?`
      )
      .run(status, errorMessage || null, id);
  }

  deleteDocument(id: string): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.prepare("DELETE FROM uploaded_documents WHERE id = ?").run(id);
    logger.info(`Deleted document: ${id}`);
  }

  // ==================== Vector Store State ====================

  updateVectorStoreState(
    totalDocuments: number,
    totalChunks: number,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db
      .prepare(
        `UPDATE vector_store_state 
         SET total_documents = ?, total_chunks = ?, last_updated = ?, metadata = ?
         WHERE id = 1`
      )
      .run(
        totalDocuments,
        totalChunks,
        Date.now(),
        metadata ? JSON.stringify(metadata) : null
      );

    logger.info(
      `Updated vector store state: ${totalDocuments} docs, ${totalChunks} chunks`
    );
  }

  getVectorStoreState(): VectorStoreState | null {
    if (!this.db) throw new Error("Database not initialized");

    const row = this.db
      .prepare(
        `SELECT id, total_documents as totalDocuments, total_chunks as totalChunks,
         last_updated as lastUpdated, metadata FROM vector_store_state WHERE id = 1`
      )
      .get() as VectorStoreState | undefined;

    return row || null;
  }

  // ==================== Utility ====================

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info("Database closed");
    }
  }

  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Get database statistics
   */
  getStats(): {
    threads: number;
    messages: number;
    documents: number;
    dbSizeMB: number;
  } {
    if (!this.db) throw new Error("Database not initialized");

    const threads = (
      this.db
        .prepare("SELECT COUNT(*) as count FROM conversation_threads")
        .get() as { count: number }
    ).count;

    const messages = (
      this.db.prepare("SELECT COUNT(*) as count FROM chat_messages").get() as {
        count: number;
      }
    ).count;

    const documents = (
      this.db
        .prepare("SELECT COUNT(*) as count FROM uploaded_documents")
        .get() as { count: number }
    ).count;

    const dbSizeMB = fs.existsSync(this.dbPath)
      ? fs.statSync(this.dbPath).size / (1024 * 1024)
      : 0;

    return {
      threads,
      messages,
      documents,
      dbSizeMB: Math.round(dbSizeMB * 100) / 100,
    };
  }
}

// Singleton instance
export const dbManager = new DatabaseManager();
