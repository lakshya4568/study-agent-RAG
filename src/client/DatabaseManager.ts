import DatabaseConstructor, { Database } from "better-sqlite3";
import path from "path";
import { app } from "electron";
import fs from "fs";
import crypto from "crypto";
import { User, ChatMessage, UploadedDocument, Thread } from "./types";

interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  thread_id: string;
  metadata: string;
}

interface DocumentRow {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  uploaded_at: number;
  status?: string;
  chunk_count?: number;
  error?: string;
}

export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.dbPath = path.join(userDataPath, "study-agent.db");
  }

  initialize() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new DatabaseConstructor(this.dbPath);
      this.db.pragma("journal_mode = WAL");
      this.createTables();
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }

  private createTables() {
    if (!this.db) return;

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Threads table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        user_id TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        thread_id TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
      )
    `);

    // Documents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL,
        uploaded_at INTEGER NOT NULL,
        status TEXT DEFAULT 'processing',
        chunk_count INTEGER DEFAULT 0,
        error TEXT
      )
    `);
  }

  // User methods
  registerUser(email: string, passwordHash: string, username: string): User {
    if (!this.db) throw new Error("Database not initialized");
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const stmt = this.db.prepare(
      "INSERT INTO users (id, email, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(id, email, username, passwordHash, createdAt);

    return { id, email, username, created_at: createdAt };
  }

  loginUser(email: string, passwordHash: string): User | null {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "SELECT * FROM users WHERE email = ? AND password_hash = ?"
    );
    const user = stmt.get(email, passwordHash) as UserRow | undefined;

    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at,
    };
  }

  getUser(id: string): User | null {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
    const user = stmt.get(id) as UserRow | undefined;

    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at,
    };
  }

  // Thread methods
  createThread(id: string, title: string, userId?: string) {
    if (!this.db) throw new Error("Database not initialized");
    const now = Date.now();
    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO threads (id, title, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(id, title, now, now, userId || null);
  }

  getAllThreads(userId?: string): Thread[] {
    if (!this.db) throw new Error("Database not initialized");
    let stmt;
    if (userId) {
      stmt = this.db.prepare(
        "SELECT * FROM threads WHERE user_id = ? ORDER BY updated_at DESC"
      );
      return stmt.all(userId) as Thread[];
    } else {
      stmt = this.db.prepare("SELECT * FROM threads ORDER BY updated_at DESC");
      return stmt.all() as Thread[];
    }
  }

  deleteThread(id: string) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare("DELETE FROM threads WHERE id = ?");
    stmt.run(id);
  }

  // Message methods
  saveMessage(message: ChatMessage) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "INSERT INTO messages (id, role, content, timestamp, thread_id, metadata) VALUES (?, ?, ?, ?, ?, ?)"
    );
    stmt.run(
      message.id,
      message.role,
      message.content,
      message.timestamp,
      message.threadId,
      JSON.stringify(message.metadata || {})
    );

    // Update thread timestamp
    const updateThread = this.db.prepare(
      "UPDATE threads SET updated_at = ? WHERE id = ?"
    );
    updateThread.run(message.timestamp, message.threadId);
  }

  getMessages(threadId: string, limit?: number): ChatMessage[] {
    if (!this.db) throw new Error("Database not initialized");
    let query =
      "SELECT * FROM messages WHERE thread_id = ? ORDER BY timestamp ASC";
    if (limit) query += ` LIMIT ${limit}`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(threadId) as MessageRow[];

    return rows.map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant" | "system",
      content: row.content,
      timestamp: row.timestamp,
      threadId: row.thread_id,
      metadata: JSON.parse(row.metadata || "{}"),
    }));
  }

  clearMessages(threadId: string) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare("DELETE FROM messages WHERE thread_id = ?");
    stmt.run(threadId);
  }

  // Document methods
  saveDocument(doc: UploadedDocument) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "INSERT INTO documents (id, name, path, type, size, uploaded_at, status, chunk_count, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    stmt.run(
      doc.id,
      doc.name,
      doc.path,
      doc.type,
      doc.size,
      doc.uploadedAt,
      doc.status || "processing",
      doc.chunkCount || 0,
      doc.error || null
    );
  }

  getAllDocuments(): UploadedDocument[] {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "SELECT * FROM documents ORDER BY uploaded_at DESC"
    );
    const rows = stmt.all() as DocumentRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      path: row.path,
      type: row.type,
      size: row.size,
      uploadedAt: row.uploaded_at,
      status: (row.status as "processing" | "ready" | "error") || "processing",
      chunkCount: row.chunk_count || 0,
      error: row.error,
    }));
  }

  updateDocumentStatus(id: string, status: string, error?: string) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "UPDATE documents SET status = ?, error = ? WHERE id = ?"
    );
    stmt.run(status, error || null, id);
  }

  updateDocumentChunkCount(id: string, count: number) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "UPDATE documents SET chunk_count = ? WHERE id = ?"
    );
    stmt.run(count, id);
  }

  deleteDocument(id: string) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare("DELETE FROM documents WHERE id = ?");
    stmt.run(id);
  }

  // Stats
  getStats() {
    if (!this.db) throw new Error("Database not initialized");

    const threads = this.db
      .prepare("SELECT COUNT(*) as count FROM threads")
      .get() as { count: number };
    const messages = this.db
      .prepare("SELECT COUNT(*) as count FROM messages")
      .get() as { count: number };
    const documents = this.db
      .prepare("SELECT COUNT(*) as count FROM documents")
      .get() as { count: number };

    let dbSizeMB = 0;
    try {
      const stats = fs.statSync(this.dbPath);
      dbSizeMB = stats.size / (1024 * 1024);
    } catch (e) {
      // Ignore error if file doesn't exist yet
    }

    return {
      threads: threads.count,
      messages: messages.count,
      documents: documents.count,
      dbSizeMB,
    };
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const dbManager = new DatabaseManager();
