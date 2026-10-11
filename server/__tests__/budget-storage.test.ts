import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "../db/schema";
import { migrateBudgetRevision } from "../db/schema";
import { MockDatabase } from "../db/mock-db";
let database: DatabaseClient;
vi.mock("../db/schema", async importOriginal => ({ ...await importOriginal<object>(), getDB: () => database }));
import { readBudget, saveBudget } from "../budget";
const originalEnvironment = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = originalEnvironment; vi.restoreAllMocks(); });

describe("budget storage", () => {
  it("migrates an existing SQLite row once without changing its data or preferences", () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec("CREATE TABLE budget_data (user_id TEXT UNIQUE, finance_data TEXT, dark_mode INTEGER, currency TEXT, updated_at TEXT); INSERT INTO budget_data VALUES ('owner', '{\"income\":[],\"categories\":[]}', 0, '$', 'old');");
      database = { pragma: sql => sqlite.prepare(`PRAGMA ${sql}`).all(), exec: sql => sqlite.exec(sql), prepare: sql => sqlite.prepare(sql) } as DatabaseClient;
      migrateBudgetRevision(database); migrateBudgetRevision(database);
      expect(readBudget("owner")).toMatchObject({ revision: 0, dark_mode: false, currency: "$", updated_at: "old", finance_data: { income: [], categories: [] } });
      expect(saveBudget("owner", { finance_data: { income: [], categories: [] }, expected_revision: 0, dark_mode: false, currency: "$" }).revision).toBe(1);
    } finally { sqlite.close(); }
  });
  it("preserves legacy JSON rows across restart and rolls back a failed disk write", () => {
    process.env.NODE_ENV = "production";
    const directory = fs.mkdtempSync(path.join(process.cwd(), ".toolchain", "json-storage-"));
    const file = path.join(directory, "budget.json");
    const data = { income: [], categories: [] };
    fs.writeFileSync(file, JSON.stringify({ users: [{ id: "owner", username: "admin", password_hash: "disabled" }], budget_data: [{ id: "budget", user_id: "owner", finance_data: JSON.stringify(data), dark_mode: 0, currency: "$", updated_at: "old" }] }));
    try {
      database = new MockDatabase(file);
      expect(readBudget("owner").revision).toBe(0);
      saveBudget("owner", { finance_data: data, expected_revision: 0, dark_mode: false, currency: "$" });
      database = new MockDatabase(file);
      expect(readBudget("owner")).toMatchObject({ revision: 1, finance_data: data });
      vi.spyOn(fs, "renameSync").mockImplementation(() => { throw new Error("Disk write failed"); });
      expect(() => saveBudget("owner", { finance_data: data, expected_revision: 1, dark_mode: true, currency: "€" })).toThrow("Failed to save budget storage");
      expect(readBudget("owner")).toMatchObject({ revision: 1, dark_mode: false, currency: "$" });
      database = new MockDatabase(file);
      expect(readBudget("owner")).toMatchObject({ revision: 1, dark_mode: false, currency: "$" });
    } finally { vi.restoreAllMocks(); fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
