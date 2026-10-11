import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { DatabaseSync } from "node:sqlite";
import { MockDatabase } from "../db/mock-db";
import type { DatabaseClient } from "../db/schema";
import { config } from "../config";

let database: DatabaseClient;
vi.mock("../db/schema", () => ({ getDB: () => database }));
import { budgetRoutes } from "../routes/budget";
import { assistantRoutes } from "../routes/assistant";

const data = { income: [{ id: "i", name: "Salary", value: 3000 }], categories: [
  { id: "c", name: "Housing", color: "#f00", items: [{ id: "e", name: "Rent", value: 800, infos: "Keep me", billingPeriod: "Annual" }] },
  { id: "s", name: "Savings", type: "investment", color: "#0f0", items: [{ id: "v", name: "ETF", value: 500 }] }
] };
const token = "a".repeat(64);
const header = { authorization: `Bearer ${token}` };
let app: FastifyInstance;
let sqlite: DatabaseSync | undefined;
const originalAuth = config.AUTH_ENABLED;
const originalToken = config.ASSISTANT_API_TOKEN;

describe.each(["SQLite", "JSON fallback"])("budget operations with %s", backend => {
  beforeEach(async () => {
    config.AUTH_ENABLED = false; config.ASSISTANT_API_TOKEN = token;
    if (backend === "SQLite") {
      sqlite = new DatabaseSync(":memory:");
      sqlite.exec("CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT, password_hash TEXT); CREATE TABLE budget_data(user_id TEXT UNIQUE REFERENCES users(id), finance_data TEXT, dark_mode INTEGER, currency TEXT, updated_at TEXT, revision INTEGER DEFAULT 0);");
      database = { prepare: sql => sqlite!.prepare(sql), exec: sql => sqlite!.exec(sql), pragma: () => undefined } as DatabaseClient;
    } else database = new MockDatabase("unused-test.db");
    database.prepare("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)").run("default", "admin", "disabled");
    app = Fastify(); await app.register(jwt, { secret: "test-secret" });
    await app.register(budgetRoutes); await app.register(assistantRoutes);
  });
  afterEach(async () => { await app.close(); sqlite?.close(); sqlite = undefined; config.AUTH_ENABLED = originalAuth; config.ASSISTANT_API_TOKEN = originalToken; });
  const read = async () => (await app.inject({ method: "GET", url: "/api/assistant/budget", headers: header })).json();
  const save = (finance_data = data, expected_revision = 0) => app.inject({ method: "PUT", url: "/api/budget", payload: { finance_data, expected_revision, dark_mode: false, currency: "$" } });
  const action = (operation: string, expected_revision: number, fields = {}) => app.inject({ method: "POST", url: "/api/assistant/actions", headers: header, payload: { operation, expected_revision, ...fields } });

  it("is disabled by default and requires a dedicated token even in preview mode", async () => {
    config.ASSISTANT_API_TOKEN = "";
    expect((await app.inject("/api/assistant/budget")).statusCode).toBe(503);
    config.ASSISTANT_API_TOKEN = token;
    for (const authorization of [undefined, "Bearer wrong", "Bearer browser-jwt"]) {
      expect((await app.inject({ url: "/api/assistant/budget", headers: authorization ? { authorization } : {} })).statusCode).toBe(401);
    }
    expect((await read()).initialized).toBe(false);
    config.ASSISTANT_API_TOKEN = "b".repeat(64);
    expect((await app.inject({ url: "/api/assistant/budget", headers: header })).statusCode).toBe(401);
  });
  it("reads saved values and shared totals without changing preferences or metadata", async () => {
    expect((await save()).statusCode).toBe(200);
    const snapshot = await read();
    expect(snapshot).toMatchObject({ finance_data: data, currency: "$", dark_mode: false, revision: 1, initialized: true });
    expect(snapshot.totals).toMatchObject({ income: 3000, expenses: 800, investments: 500, remaining: 1700 });
    const updated = await action("update_entry", 1, { kind: "item", category_id: "c", entry_id: "e", patch: { value: 900 } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().affected).toMatchObject({ id: "e", value: 900, infos: "Keep me", billingPeriod: "Annual" });
    expect(updated.json().snapshot).toMatchObject({ currency: "$", dark_mode: false, revision: 2 });
  });
  it("rejects stale browser/assistant saves and clients missing a revision", async () => {
    await save();
    expect((await action("update_entry", 1, { kind: "income", entry_id: "i", patch: { value: 4000 } })).statusCode).toBe(200);
    expect((await save(data, 1)).statusCode).toBe(409);
    expect((await action("delete_entry", 1, { kind: "income", entry_id: "i" })).statusCode).toBe(409);
    expect((await app.inject({ method: "PUT", url: "/api/budget", payload: { finance_data: data, dark_mode: false, currency: "$" } })).statusCode).toBe(428);
    expect((await read()).finance_data.income[0].value).toBe(4000);
  });
  it("creates zero placeholders from an uninitialized budget and preserves empty budgets", async () => {
    const created = (await action("create_category", 0, { name: "New section", type: "investment" })).json();
    const category_id = created.affected.id;
    expect(created.snapshot.finance_data.income).toEqual([]);
    const entry = (await action("create_entry", 1, { kind: "item", category_id, name: "Placeholder" })).json();
    expect(entry.affected.value).toBe(0);
    expect((await action("delete_category", 2, { category_id })).statusCode).toBe(400);
    expect((await action("delete_entry", 2, { kind: "item", category_id, entry_id: entry.affected.id })).statusCode).toBe(200);
    expect((await action("delete_category", 3, { category_id })).statusCode).toBe(200);
    expect(await read()).toMatchObject({ initialized: true, revision: 4, finance_data: { income: [], categories: [] } });
    expect((await app.inject("/api/budget")).json().finance_data).toEqual({ income: [], categories: [] });
  });
  it("supports income creation/deletion, category editing and explicit metadata clearing", async () => {
    await save();
    expect((await action("update_category", 1, { category_id: "c", patch: { name: "Home", color: "#123456", type: "investment" } })).statusCode).toBe(200);
    const updated = await action("update_entry", 2, { kind: "item", category_id: "c", entry_id: "e", patch: { infos: null } });
    expect(updated.json().affected.infos).toBeUndefined();
    expect(updated.json().affected.billingPeriod).toBe("Annual");
    const income = (await action("create_entry", 3, { kind: "income", name: "Side work", value: 100 })).json();
    expect((await action("delete_entry", 4, { kind: "income", entry_id: income.affected.id })).statusCode).toBe(200);
    expect((await read()).finance_data.income).toEqual(data.income);
  });
  it("rejects invalid actions and IDs without writing", async () => {
    await save();
    const cases = [
      { operation: "update_entry", kind: "item", category_id: "s", entry_id: "e", patch: { value: 900 } },
      { operation: "update_entry", kind: "income", entry_id: "missing", patch: { value: 900 } },
      { operation: "update_entry", kind: "income", entry_id: "i", patch: { value: -1 } },
      { operation: "update_entry", kind: "income", entry_id: "i", patch: { infos: "no" } },
      { operation: "update_entry", kind: "item", category_id: "c", entry_id: "e", patch: { startDate: "2026-02-30" } },
      { operation: "update_category", category_id: "c", patch: { id: "other" } },
      { operation: "create_category", name: "x", type: "unknown" },
      { operation: "create_entry", kind: "income", name: "x", value: "100" },
      { operation: "execute_sql", query: "DELETE FROM users" },
    ];
    for (const item of cases) {
      const result = await app.inject({ method: "POST", url: "/api/assistant/actions", headers: header, payload: { expected_revision: 1, ...item } });
      expect([400, 404]).toContain(result.statusCode);
    }
    expect((await read()).revision).toBe(1); expect((await read()).finance_data).toEqual(data);
  });
  it("resolves the only account and keeps the assistant token out of browser authentication", async () => {
    config.AUTH_ENABLED = true;
    expect((await app.inject({ method: "PUT", url: "/api/budget", headers: header, payload: {} })).statusCode).toBe(401);
    expect((await read()).revision).toBe(0);
    database.prepare("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)").run("second", "other", "disabled");
    expect((await app.inject({ url: "/api/assistant/budget", headers: header })).statusCode).toBe(409);
  });
});
