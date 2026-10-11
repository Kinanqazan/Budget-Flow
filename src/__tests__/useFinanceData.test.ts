// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockApi = vi.hoisted(() => ({
  setToken: vi.fn(),
  clearToken: vi.fn(),
  auth: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    deleteAccount: vi.fn(),
    setupStatus: vi.fn(),
  },
  budget: {
    get: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  api: mockApi,
  TOKEN_KEY: "budgetflow-token",
}));

import { useFinanceData } from "@/hooks/useFinanceData";

const STORAGE_KEY = "budgetflow-data";
const CURRENCY_KEY = "budgetflow-currency";

function setLocalStorageData(data: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

describe("useFinanceData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("stats calculation", () => {
    it("calculates stats from data", () => {
      setLocalStorageData({
        income: [{ id: "i1", name: "Salary", value: 5000 }],
        categories: [
          {
            id: "c1", name: "Housing", color: "#f00",
            items: [{ id: "w1", name: "Rent", value: 1500 }],
          },
        ],
      });

      const { result } = renderHook(() => useFinanceData("user1", true));

      expect(result.current.stats.income).toBe(5000);
      expect(result.current.stats.expenses).toBe(1500);
      expect(result.current.stats.remaining).toBe(3500);
      expect(result.current.stats.cats).toHaveLength(1);
      expect(result.current.stats.cats[0].total).toBe(1500);
    });

    it("tracks investments separately while subtracting them from remaining", () => {
      setLocalStorageData({
        income: [{ id: "i1", name: "Salary", value: 5000 }],
        categories: [
          {
            id: "c1", name: "Housing", color: "#f00", type: "expense",
            items: [{ id: "w1", name: "Rent", value: 1500 }],
          },
          {
            id: "c2", name: "ETF", color: "#0f0", type: "investment",
            items: [{ id: "w2", name: "Monthly ETF", value: 500 }],
          },
        ],
      });

      const { result } = renderHook(() => useFinanceData("user1", true));

      expect(result.current.stats.expenses).toBe(1500);
      expect(result.current.stats.investments).toBe(500);
      expect(result.current.stats.remaining).toBe(3000);
      expect(result.current.stats.expenseCats).toHaveLength(1);
      expect(result.current.stats.investmentCats).toHaveLength(1);
    });

    it("returns zero stats for empty data", () => {
      setLocalStorageData({ income: [], categories: [] });

      const { result } = renderHook(() => useFinanceData("user1", true));

      expect(result.current.stats.income).toBe(0);
      expect(result.current.stats.expenses).toBe(0);
      expect(result.current.stats.remaining).toBe(0);
    });
  });

  describe("income CRUD", () => {
    it("adds an income item", () => {
      setLocalStorageData({ income: [], categories: [] });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.addIncome());

      expect(result.current.data.income).toHaveLength(1);
      expect(result.current.data.income[0].name).toBe("New");
    });

    it("removes an income item", () => {
      setLocalStorageData({
        income: [{ id: "i1", name: "Salary", value: 5000 }],
        categories: [],
      });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.removeIncome(0));

      expect(result.current.data.income).toHaveLength(0);
    });

    it("updates an income field", () => {
      setLocalStorageData({
        income: [{ id: "i1", name: "Salary", value: 5000 }],
        categories: [],
      });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.updateIncome(0, "value", 6000));
      act(() => result.current.updateIncome(0, "name", "Bonus"));

      expect(result.current.data.income[0].value).toBe(6000);
      expect(result.current.data.income[0].name).toBe("Bonus");
    });
  });

  describe("category CRUD", () => {
    it("adds a category", () => {
      setLocalStorageData({ income: [], categories: [] });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.addCategory());

      expect(result.current.data.categories).toHaveLength(1);
      expect(result.current.data.categories[0].name).toBe("New Category");
    });

    it("removes a category", () => {
      setLocalStorageData({
        income: [],
        categories: [{ id: "c1", name: "Test", color: "#f00", items: [] }],
      });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.removeCategory(0));

      expect(result.current.data.categories).toHaveLength(0);
    });

    it("updates a category field", () => {
      setLocalStorageData({
        income: [],
        categories: [{ id: "c1", name: "Old", color: "#f00", items: [] }],
      });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.updateCategory(0, "name", "New"));
      act(() => result.current.updateCategory(0, "color", "#0f0"));

      expect(result.current.data.categories[0].name).toBe("New");
      expect(result.current.data.categories[0].color).toBe("#0f0");
    });
  });

  describe("item CRUD", () => {
    it("adds an item to a category", () => {
      setLocalStorageData({
        income: [],
        categories: [{ id: "c1", name: "Test", color: "#f00", items: [] }],
      });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.addItem(0));

      expect(result.current.data.categories[0].items).toHaveLength(1);
      expect(result.current.data.categories[0].items[0].name).toBe("New");
    });

    it("removes an item from a category", () => {
      setLocalStorageData({
        income: [],
        categories: [{ id: "c1", name: "Test", color: "#f00", items: [{ id: "w1", name: "Rent", value: 1000 }] }],
      });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.removeItem(0, 0));

      expect(result.current.data.categories[0].items).toHaveLength(0);
    });

    it("updates an item field", () => {
      setLocalStorageData({
        income: [],
        categories: [{ id: "c1", name: "Test", color: "#f00", items: [{ id: "w1", name: "Rent", value: 1000 }] }],
      });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.updateItem(0, 0, "value", 1200));
      act(() => result.current.updateItem(0, 0, "name", "Mortgage"));

      expect(result.current.data.categories[0].items[0].value).toBe(1200);
      expect(result.current.data.categories[0].items[0].name).toBe("Mortgage");
    });
  });

  describe("loadFromServer", () => {
    it("loads data from server and updates state", async () => {
      mockApi.budget.get.mockResolvedValue({
        finance_data: { income: [{ id: "i1", name: "Salary", value: 7000 }], categories: [{ id: "c1", name: "Housing", color: "#f00", items: [] }] },
        dark_mode: true,
        currency: "$",
        revision: 1,
      });

      setLocalStorageData({ income: [], categories: [] });

      const { result } = renderHook(() => useFinanceData("user1", true));

      await act(async () => {
        await result.current.loadFromServer();
      });

      expect(result.current.data.income[0].value).toBe(7000);
    });
  });

  describe("currency", () => {
    it("changes currency", () => {
      setLocalStorageData({ income: [], categories: [] });

      const { result } = renderHook(() => useFinanceData("user1", true));

      act(() => result.current.setCurrency("$"));

      expect(result.current.currency).toBe("$");
      expect(localStorage.getItem(CURRENCY_KEY)).toBe("$");
    });
  });
});
