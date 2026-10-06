import BetterSqlite3 from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "../config";
import { MockDatabase } from "./mock-db";

export interface DatabaseClient {
  pragma(sql: string): unknown;
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: (string | number | boolean | null)[]): unknown;
    run(...params: (string | number | boolean | null)[]): { changes: number };
  };
}

let db: DatabaseClient | null = null;

export function initDB(): DatabaseClient {
  if (db) return db;

  const dir = config.DATA_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    const nativeDb = new BetterSqlite3(path.join(dir, "budgetflow.db"));
    nativeDb.pragma("journal_mode = WAL");
    nativeDb.pragma("foreign_keys = ON");
    db = nativeDb as DatabaseClient;
  } catch (e) {
    console.warn("Failed to load native better-sqlite3 bindings, falling back to JSON MockDatabase:", e);
    db = new MockDatabase(path.join(dir, "budgetflow.db")) as DatabaseClient;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budget_data (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      finance_data TEXT NOT NULL DEFAULT '{}',
      dark_mode INTEGER DEFAULT 1,
      currency TEXT DEFAULT '€',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
    INSERT OR IGNORE INTO schema_version (version) VALUES (1);
  `);

  if (!config.AUTH_ENABLED) {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash)
      VALUES ('default', 'admin', 'disabled')
    `).run();
  }

  return db;
}

export function getDB(): DatabaseClient {
  if (!db) throw new Error("Database not initialized. Call initDB() first.");
  return db;
}
