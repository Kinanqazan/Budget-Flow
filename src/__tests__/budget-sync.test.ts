// @vitest-environment jsdom
import { act, renderHook, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ApiBudgetData } from "@/types/api";
const budget = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { budget } }));
import { useFinanceData } from "@/hooks/useFinanceData";
const snapshot = (value = 3000, revision = 1): ApiBudgetData => ({
  finance_data: { income: [{ id: "i", name: "Salary", value }], categories: [] }, dark_mode: false, currency: "$", revision,
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const flush = () => act(async () => { await Promise.resolve(); });
const advance = (milliseconds: number) => act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });

beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks(); localStorage.clear();
  budget.get.mockResolvedValue(snapshot());
  budget.save.mockImplementation((data, dark_mode, currency, revision) => Promise.resolve({ finance_data: data, dark_mode, currency, revision: revision + 1 }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("browser synchronization", () => {
  it("loads a saved empty budget and refreshes a clean view without redundant writes", async () => {
    budget.get.mockResolvedValue({ ...snapshot(), finance_data: { income: [], categories: [] } });
    const { result } = renderHook(() => useFinanceData("owner", true));
    await flush(); expect(result.current.data).toEqual({ income: [], categories: [] });
    await advance(2000); expect(budget.save).not.toHaveBeenCalled();
    budget.get.mockResolvedValue(snapshot(4500, 2));
    await advance(8000); expect(result.current.data.income[0].value).toBe(4500);
    await advance(2000); expect(budget.save).not.toHaveBeenCalled();
  });
  it("sends the acknowledged revision, and keeps edits typed while saving pending", async () => {
    const pending = deferred<ApiBudgetData>(); budget.save.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useFinanceData("owner", true)); await flush();
    act(() => result.current.updateIncome(0, "value", 4000));
    await advance(2000);
    expect(budget.save).toHaveBeenNthCalledWith(1, snapshot(4000).finance_data, false, "$", 1);
    act(() => result.current.updateIncome(0, "value", 5000));
    await act(async () => { pending.resolve(snapshot(4000, 2)); await pending.promise; });
    expect(result.current.data.income[0].value).toBe(5000);
    await advance(2000);
    expect(budget.save).toHaveBeenNthCalledWith(2, snapshot(5000).finance_data, false, "$", 2);
  });
  it("serializes manual saves behind autosave", async () => {
    const pending = deferred<ApiBudgetData>(); budget.save.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useFinanceData("owner", true)); await flush();
    act(() => result.current.updateIncome(0, "value", 4000)); await advance(2000);
    act(() => result.current.updateIncome(0, "value", 5000));
    let manual!: Promise<void>; act(() => { manual = result.current.save(); });
    expect(budget.save).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(snapshot(4000, 2)); await manual; });
    expect(budget.save).toHaveBeenCalledTimes(2);
    expect(budget.save.mock.calls[1][3]).toBe(2);
  });
  it("preserves drafts and pauses saves on conflict until explicitly loading saved values", async () => {
    budget.save.mockRejectedValue(Object.assign(new Error("conflict"), { status: 409 }));
    const { result } = renderHook(() => useFinanceData("owner", true)); await flush();
    act(() => result.current.updateIncome(0, "value", 4000)); await advance(2000);
    expect(result.current.syncConflict).toBe(true); expect(result.current.data.income[0].value).toBe(4000);
    budget.get.mockResolvedValue(snapshot(3500, 2)); await advance(20000);
    expect(result.current.data.income[0].value).toBe(4000); expect(budget.save).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.loadSavedBudget(); });
    expect(result.current.syncConflict).toBe(false); expect(result.current.data.income[0].value).toBe(3500);
    act(() => result.current.updateIncome(0, "value", 3600));
    budget.save.mockResolvedValue(snapshot(3600, 3)); await advance(2000);
    expect(budget.save.mock.calls[1][3]).toBe(2);
  });
  it("does not overwrite typing with a delayed refresh", async () => {
    const pending = deferred<ApiBudgetData>();
    const { result } = renderHook(() => useFinanceData("owner", true)); await flush();
    budget.get.mockReturnValueOnce(pending.promise);
    act(() => { window.dispatchEvent(new Event("focus")); });
    act(() => result.current.updateIncome(0, "value", 4000));
    await act(async () => { pending.resolve(snapshot(3500, 2)); await pending.promise; });
    expect(result.current.data.income[0].value).toBe(4000);
    await advance(2000); expect(budget.save.mock.calls[0][3]).toBe(1);
  });
  it("does not autosave a cached draft when the first read fails", async () => {
    budget.get.mockRejectedValue(new Error("offline"));
    localStorage.setItem("budgetflow-data", JSON.stringify(snapshot().finance_data));
    const { result } = renderHook(() => useFinanceData("owner", true)); await flush();
    act(() => result.current.updateIncome(0, "value", 4000)); await advance(12000);
    expect(budget.save).not.toHaveBeenCalled(); expect(result.current.data.income[0].value).toBe(4000);
    budget.get.mockResolvedValue(snapshot(3500, 2)); await advance(10000);
    expect(result.current.syncConflict).toBe(true); expect(result.current.data.income[0].value).toBe(4000);
  });
  it("ignores an old account response after switching accounts", async () => {
    const pending = deferred<ApiBudgetData>(); budget.get.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(({ user }) => useFinanceData(user, true), { initialProps: { user: "first" } });
    budget.get.mockResolvedValue(snapshot(5000, 8)); rerender({ user: "second" }); await flush();
    await act(async () => { pending.resolve(snapshot(2000, 1)); await pending.promise; });
    expect(result.current.data.income[0].value).toBe(5000);
    act(() => result.current.updateIncome(0, "value", 6000)); await advance(2000);
    expect(budget.save.mock.calls[0][3]).toBe(8);
  });
  it("pauses on an uncertain write outcome rather than retrying it", async () => {
    budget.save.mockRejectedValue(new Error("connection lost"));
    const { result } = renderHook(() => useFinanceData("owner", true)); await flush();
    act(() => result.current.updateIncome(0, "value", 4000)); await advance(12000);
    expect(result.current.syncConflict).toBe(true); expect(budget.save).toHaveBeenCalledTimes(1);
  });
  it("never writes to an older backend that does not return revisions", async () => {
    budget.get.mockResolvedValue({ ...snapshot(), revision: undefined });
    const { result } = renderHook(() => useFinanceData("owner", true)); await flush();
    act(() => result.current.addIncome()); await advance(12000);
    expect(budget.save).not.toHaveBeenCalled();
  });
  it("does not loop automatic retries for a rejected snapshot", async () => {
    budget.save.mockRejectedValue(Object.assign(new Error("Invalid finance_data"), { status: 400 }));
    const { result } = renderHook(() => useFinanceData("owner", true)); await flush();
    act(() => result.current.updateIncome(0, "value", 4000)); await advance(12000);
    expect(result.current.syncConflict).toBe(true); expect(budget.save).toHaveBeenCalledTimes(1);
    expect(result.current.data.income[0].value).toBe(4000);
  });
});
