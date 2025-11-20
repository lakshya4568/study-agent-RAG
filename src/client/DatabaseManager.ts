/**
 * SQLite Database Manager for Study Agent
 * Handles persistent storage of:
 * - Chat messages and conversations
 * - Uploaded documents metadata
 * - Vector store state
 * - User preferences
 */

import DatabaseConstructor, { type Database } from "better-sqlite3";
import path from "node:path";
import { app } from "electron";
import fs from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { logger } from "../client/logger";

interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  salt: string;
  avatar_url: string;
  created_at: number;
}

export interface User {
  id: number;
  email: string;
  username: string;
  passwordHash: string;
  salt: string;
  avatarUrl?: string;
  createdAt: number;
}

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
  userId: number;
}

export class DatabaseManager {
  private db: Database | null = null;
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
      this.db = new DatabaseConstructor(this.dbPath);
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

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        avatar_url TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Conversation threads table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_threads (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_message_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
        user_id INTEGER,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        chunk_count INTEGER DEFAULT 0,
        uploaded_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('processing', 'ready', 'error')),
        error_message TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Document chunks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB,
        metadata TEXT,
        chunk_index INTEGER,
        FOREIGN KEY (document_id) REFERENCES uploaded_documents(id) ON DELETE CASCADE
      )
    `);

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        user_id INTEGER PRIMARY KEY,
        theme TEXT DEFAULT 'dark',
        model_preferences TEXT,
        api_keys TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

  // ==================== User Management ====================

  registerUser(email: string, password: string, username?: string): User {
    if (!this.db) throw new Error("Database not initialized");

    const salt = randomBytes(16).toString("hex");
    const passwordHash = scryptSync(password, salt, 64).toString("hex");
    const now = Date.now();

    try {
      const info = this.db
        .prepare(
          `INSERT INTO users (email, username, password_hash, salt, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(email, username || email.split("@")[0], passwordHash, salt, now);

      return {
        id: info.lastInsertRowid as number,
        email,
        username: username || email.split("@")[0],
        passwordHash,
        salt,
        createdAt: now,
      };
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new Error("Email already exists");
      }
      throw error;
    }
  }

  loginUser(email: string, password: string): User | null {
    if (!this.db) throw new Error("Database not initialized");

    const user = this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as UserRow | undefined;

    if (!user) return null;

    const hashedPassword = scryptSync(password, user.salt, 64).toString("hex");
    const match = timingSafeEqual(
      Buffer.from(user.password_hash, "hex"),
      Buffer.from(hashedPassword, "hex")
    );

    if (match) {
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash: user.password_hash,
        salt: user.salt,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      };
    }

    return null;
  }

  getUser(id: number): User | null {
    if (!this.db) throw new Error("Database not initialized");

    const user = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | UserRow
      | undefined;

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      passwordHash: user.password_hash,
      salt: user.salt,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    };
  }

  // ==================== Conversation Threads ====================

  createThread(id: string, title: string, userId?: number): void {
    if (!this.db) throw new Error("Database not initialized");

    const now = Date.now();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO conversation_threads 
         (id, user_id, title, created_at, last_message_at, message_count)
         VALUES (?, ?, ?, ?, ?, 0)`
      )
      .run(id, userId || null, title, now, now);

    logger.info(`Created conversation thread: ${id}`);
  }

  getThread(id: string): ConversationThread | null {
    if (!this.db) throw new Error("Database not initialized");

    const row = this.db
      .prepare(
        `SELECT id, user_id as userId, title, created_at as createdAt, last_message_at as lastMessageAt, 
         message_count as messageCount FROM conversation_threads WHERE id = ?`
      )
      .get(id) as ConversationThread | undefined;

    return row || null;
  }

  getAllThreads(userId?: number): ConversationThread[] {
    if (!this.db) throw new Error("Database not initialized");

    const query = userId
      ? `SELECT id, user_id as userId, title, created_at as createdAt, last_message_at as lastMessageAt,
         message_count as messageCount FROM conversation_threads 
         WHERE user_id = ?
         ORDER BY last_message_at DESC`
      : `SELECT id, user_id as userId, title, created_at as createdAt, last_message_at as lastMessageAt,
         message_count as messageCount FROM conversation_threads 
         ORDER BY last_message_at DESC`;

    const params = userId ? [userId] : [];
    return this.db.prepare(query).all(...params) as ConversationThread[];
  }

  deleteThread(id: string): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.prepare("DELETE FROM conversation_threads WHERE id = ?").run(id);
    logger.info(`Deleted conversation thread: ${id}`);
  }

  // ==================== Chat Messages ====================

  saveMessage(message: ChatMessage): void {
    if (!this.db) throw new Error("Database not initialized");

    const db = this.db;
    const transaction = this.db.transaction(() => {
      // Insert message
      db.prepare(
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
      db.prepare(
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

  saveDocument(doc: UploadedDocument, userId?: number): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db
      .prepare(
        `INSERT OR REPLACE INTO uploaded_documents 
         (id, user_id, file_path, file_name, file_type, file_size, chunk_count, 
          uploaded_at, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        doc.id,
        userId || null,
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

  updateDocumentChunkCount(id: string, chunkCount: number): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db
      .prepare(
        `UPDATE uploaded_documents 
         SET chunk_count = ? WHERE id = ?`
      )
      .run(chunkCount, id);
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
