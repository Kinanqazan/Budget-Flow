import crypto from "crypto";
import type { FinanceData, ExpenseItem, Category, IncomeItem } from "./finance";
import { calculateStats } from "./finance";
import { getDB } from "./db/schema";

export class BudgetError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Fields = Record<string, unknown>;
function object(value: unknown): Fields {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BudgetError(400, "Expected an object");
  return value as Fields;
}
function text(value: unknown, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new BudgetError(400, "Invalid or empty text");
  return value;
}
function amount(value: unknown, nonnegative = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || (nonnegative && value < 0)) throw new BudgetError(400, "Invalid amount");
  return value;
}
function color(value: unknown): string {
  const result = text(value);
  if (!/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(result)) throw new BudgetError(400, "Invalid color; use a hex color");
  return result;
}
function categoryType(value: unknown): "expense" | "investment" {
  if (value !== "expense" && value !== "investment") throw new BudgetError(400, "Invalid category type");
  return value;
}
const metadata = ["icon", "startDate", "endDate", "infos", "cancellationDate", "billingPeriod", "noticePeriod"];
function optionalField(key: string, value: unknown) {
  if (typeof value !== "string" || value.length > 4000) throw new BudgetError(400, `Invalid ${key}`);
  if (key === "billingPeriod" && !["Monthly", "Annual"].includes(value)) throw new BudgetError(400, "Invalid billing period");
  if (key.endsWith("Date") && value) {
    const date = new Date(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BudgetError(400, `Invalid ${key}; use YYYY-MM-DD`);
  }
}
function keys(value: Fields, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new BudgetError(400, "Unknown field");
}
export function validateFinance(value: unknown): FinanceData {
  const data = object(value);
  if (!Array.isArray(data.income) || !Array.isArray(data.categories)) throw new BudgetError(400, "Invalid finance_data");
  if (data.analysisForecast !== undefined) {
    const forecast = object(data.analysisForecast);
    keys(forecast, ["annualInterestRate", "durationYears", "initialCapital", "compoundingInterval"]);
    if (typeof forecast.annualInterestRate !== "string" || forecast.annualInterestRate.length > 24
      || typeof forecast.durationYears !== "string" || forecast.durationYears.length > 8
      || (forecast.initialCapital !== undefined && (typeof forecast.initialCapital !== "string" || forecast.initialCapital.length > 24))
      || (forecast.compoundingInterval !== undefined && forecast.compoundingInterval !== "monthly" && forecast.compoundingInterval !== "annual")) {
      throw new BudgetError(400, "Invalid analysis forecast settings");
    }
  }
  const ids = new Set<string>();
  const checkId = (value: unknown) => {
    const id = text(value, 128);
    if (ids.has(id)) throw new BudgetError(400, "Duplicate record ID");
    ids.add(id);
  };
  const checkEntry = (value: unknown, item: boolean) => {
    const entry = object(value); checkId(entry.id); amount(entry.value);
    if (typeof entry.name !== "string") throw new BudgetError(400, "Invalid entry name");
    if (item) for (const key of metadata) if (entry[key] !== undefined) optionalField(key, entry[key]);
  };
  data.income.forEach(entry => checkEntry(entry, false));
  data.categories.forEach(value => {
    const category = object(value); checkId(category.id); color(category.color);
    if (typeof category.name !== "string") throw new BudgetError(400, "Invalid category name");
    if (category.type !== undefined) categoryType(category.type);
    if (!Array.isArray(category.items)) throw new BudgetError(400, "Invalid category items");
    category.items.forEach(entry => checkEntry(entry, true));
  });
  return data as unknown as FinanceData;
}
export function revision(value: unknown): number {
  if (value === undefined) throw new BudgetError(428, "expected_revision is required; reload the saved budget first");
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new BudgetError(400, "Invalid revision");
  return value as number;
}
export function readBudget(userId: string) {
  const row = getDB().prepare("SELECT finance_data, dark_mode, currency, updated_at, revision FROM budget_data WHERE user_id = ?").get(userId) as {
    finance_data: string; dark_mode: number; currency: string; updated_at: string; revision: number;
  } | undefined;
  if (!row) return { finance_data: null, dark_mode: true, currency: "€", revision: 0 };
  const data = JSON.parse(row.finance_data);
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      ((!Array.isArray(data.income) || !Array.isArray(data.categories)) && Object.keys(data).length !== 0)) {
    throw new BudgetError(409, "Saved budget has an unsupported structure; it has been preserved");
  }
  return { finance_data: Array.isArray(data.income) && Array.isArray(data.categories) ? data as FinanceData : null,
    dark_mode: !!row.dark_mode, currency: row.currency, updated_at: row.updated_at, revision: row.revision ?? 0 };
}
export function saveBudget(userId: string, input: unknown) {
  const body = object(input);
  const data = validateFinance(body.finance_data);
  const expected = revision(body.expected_revision);
  if (typeof body.dark_mode !== "boolean") throw new BudgetError(400, "Invalid dark_mode");
  const currency = text(body.currency, 12);
  if (readBudget(userId).revision !== expected) throw new BudgetError(409, "Budget changed elsewhere. Read the saved budget before editing again.");
  const result = getDB().prepare(`
    INSERT INTO budget_data (user_id, finance_data, dark_mode, currency, updated_at, revision)
    VALUES (?, ?, ?, ?, datetime('now'), 1)
    ON CONFLICT(user_id) DO UPDATE SET
      finance_data = excluded.finance_data, dark_mode = excluded.dark_mode,
      currency = excluded.currency, updated_at = datetime('now'), revision = budget_data.revision + 1
    WHERE budget_data.revision = ?
  `).run(userId, JSON.stringify(data), body.dark_mode ? 1 : 0, currency, expected);
  if (result.changes !== 1) throw new BudgetError(409, "Budget changed elsewhere. Read the saved budget before editing again.");
  return readBudget(userId);
}
export function assistantSnapshot(userId: string) {
  const snapshot = readBudget(userId);
  return { ...snapshot, initialized: snapshot.finance_data !== null,
    totals: snapshot.finance_data ? calculateStats(snapshot.finance_data) : null,
    amount_semantics: "Values follow the app's stored amounts; Annual labels do not convert values. Investment items belong to investment categories. Read IDs and revision before editing." };
}
export function applyAction(userId: string, input: unknown) {
  const action = object(input);
  const expected = revision(action.expected_revision);
  const current = readBudget(userId);
  if (current.revision !== expected) throw new BudgetError(409, "Budget changed elsewhere. Read the saved budget before editing again.");
  const data: FinanceData = structuredClone(current.finance_data ?? { income: [], categories: [] });
  validateFinance(data);
  const operation = text(action.operation);
  const category = () => {
    const found = data.categories.find(category => category.id === text(action.category_id, 128));
    if (!found) throw new BudgetError(404, "Category not found");
    return found;
  };
  let affected: Category | ExpenseItem | IncomeItem;
  if (operation === "create_category") {
    keys(action, ["operation", "expected_revision", "name", "type", "color"]);
    affected = { id: crypto.randomUUID(), name: text(action.name), type: categoryType(action.type ?? "expense"), color: color(action.color ?? "#64B5F6"), items: [] };
    data.categories.push(affected);
  } else if (operation === "update_category") {
    keys(action, ["operation", "expected_revision", "category_id", "patch"]);
    affected = category();
    const patch = object(action.patch); keys(patch, ["name", "color", "type"]);
    if (!Object.keys(patch).length) throw new BudgetError(400, "No fields to update");
    if (patch.name !== undefined) affected.name = text(patch.name);
    if (patch.color !== undefined) affected.color = color(patch.color);
    if (patch.type !== undefined) affected.type = categoryType(patch.type);
  } else if (operation === "delete_category") {
    keys(action, ["operation", "expected_revision", "category_id"]);
    affected = category();
    if (affected.items.length) throw new BudgetError(400, "Category contains entries. Remove its entries first.");
    data.categories = data.categories.filter(entry => entry.id !== affected.id);
  } else if (["create_entry", "update_entry", "delete_entry"].includes(operation)) {
    if (action.kind !== "income" && action.kind !== "item") throw new BudgetError(400, "kind must be income or item");
    const isItem = action.kind === "item";
    if (!isItem && action.category_id !== undefined) throw new BudgetError(400, "Income has no category");
    const entries = isItem ? category().items : data.income;
    if (operation === "create_entry") {
      keys(action, ["operation", "expected_revision", "kind", "category_id", "name", "value", "metadata"]);
      affected = { id: crypto.randomUUID(), name: text(action.name), value: amount(action.value ?? 0, true) };
      if (action.metadata !== undefined) {
        const extra = object(action.metadata); keys(extra, isItem ? metadata : []);
        for (const [key, value] of Object.entries(extra)) { optionalField(key, value); Object.assign(affected, { [key]: value }); }
      }
      entries.push(affected);
    } else {
      keys(action, ["operation", "expected_revision", "kind", "category_id", "entry_id", ...(operation === "update_entry" ? ["patch"] : [])]);
      const index = entries.findIndex(entry => entry.id === text(action.entry_id, 128));
      if (index === -1) throw new BudgetError(404, "Entry not found in the specified location");
      affected = entries[index];
      if (operation === "delete_entry") entries.splice(index, 1);
      else {
        const patch = object(action.patch); keys(patch, ["name", "value", ...(isItem ? metadata : [])]);
        if (!Object.keys(patch).length) throw new BudgetError(400, "No fields to update");
        for (const [key, value] of Object.entries(patch)) {
          if (key === "name") affected.name = text(value);
          else if (key === "value") affected.value = amount(value, true);
          else if (value === null) delete (affected as unknown as Fields)[key];
          else { optionalField(key, value); Object.assign(affected, { [key]: value }); }
        }
      }
    }
  } else throw new BudgetError(400, "Unknown operation");
  saveBudget(userId, { ...current, finance_data: data, expected_revision: expected });
  return { affected, snapshot: assistantSnapshot(userId) };
}
