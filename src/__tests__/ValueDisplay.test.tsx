// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FinanceTable from "@/components/finance/FinanceTable";
import AnalysisPanel from "@/components/finance/AnalysisPanel";
import MobileAllocation from "@/components/finance/MobileAllocation";
import FinanceSidebar from "@/components/finance/FinanceSidebar";
import { calculateStats } from "../../server/finance";
import type { FinanceData } from "@/types/finance";

const data: FinanceData = {
  income: [{ id: "income", name: "Salary", value: 3000 }],
  categories: [
    { id: "investments", name: "Savings", type: "investment", color: "#8b5cf6", items: [{ id: "etf", name: "ETF", value: 300 }] },
    { id: "housing", name: "Housing", type: "expense", color: "#ff8b7b", items: [{ id: "rent", name: "Rent", value: 900 }] },
    { id: "living", name: "Living", color: "#91bfff", items: [{ id: "food", name: "Food", value: 300 }] },
  ],
};
const stats = calculateStats(data);

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Percentage display", () => {
  it("defaults the phone summary to percentages, including undefined ratios without income", () => {
    const view = render(<MobileAllocation data={data} stats={stats} />);
    const summary = screen.getByRole("region", { name: "Budget summary" });
    expect(summary.textContent).toContain("100%");
    expect(summary.textContent).toContain("50%");
    expect(summary.textContent).not.toContain("€");
    const noIncome = { ...data, income: [] };
    view.rerender(<MobileAllocation data={noIncome} stats={calculateStats(noIncome)} />);
    expect(summary.textContent).toContain("—");
    expect(summary.textContent).not.toMatch(/€|Infinity|NaN/);
  });

  it("shows analysis percentages by default and restores monthly and annual amounts on request", () => {
    const view = render(<AnalysisPanel stats={stats} currency="€" />);
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("10%")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(view.container.textContent).not.toContain("€");
    view.rerender(<AnalysisPanel stats={stats} currency="€" showPercent={false} />);
    expect(screen.getAllByText("Monthly")).toHaveLength(4);
    expect(screen.getAllByText("Annual")).toHaveLength(4);
    expect(view.container.textContent).toContain("€");
    expect(view.container.textContent).not.toContain("40%");
  });

  it("defaults the table to percentages and restores editable money columns without changing amounts", () => {
    const updateItem = vi.fn();
    const props = { data, stats, currency: "€", updateItem, removeItem: vi.fn() };
    const view = render(<FinanceTable {...props} />);
    expect(screen.getByRole("columnheader", { name: "Percentage of income" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Monthly (€)" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Annual (€)" })).toBeNull();
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(updateItem).not.toHaveBeenCalled();
    view.rerender(<FinanceTable {...props} showPercent={false} />);
    expect(screen.getByRole("columnheader", { name: "Monthly (€)" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Annual (€)" })).toBeTruthy();
    const monthly = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
    expect(monthly.value).toBe("900");
    fireEvent.change(monthly, { target: { value: "910" } });
    expect(updateItem).toHaveBeenCalledWith(1, 0, "value", 910);
  });

  it("reorders visible table columns correctly while the money columns are hidden", () => {
    const props = { data, stats, currency: "€", updateItem: vi.fn(), removeItem: vi.fn() };
    const view = render(<FinanceTable {...props} />);
    fireEvent.dragStart(screen.getByRole("columnheader", { name: "Percentage of income" }), { dataTransfer: { effectAllowed: "move" } });
    fireEvent.drop(screen.getByRole("columnheader", { name: "Budget Item" }));
    expect(screen.getAllByRole("columnheader")[0].textContent).toBe("%");
    view.rerender(<FinanceTable {...props} showPercent={false} />);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "%", "Budget Item", "Monthly (€)", "Annual (€)", "Dates / Contract", "Infos / Notes", "",
    ]);
  });

  it("keeps sidebar edits mapped to their original category indexes after grouping", () => {
    const updateIncome = vi.fn();
    const updateCategory = vi.fn();
    const updateItem = vi.fn();
    render(<FinanceSidebar data={data} updateIncome={updateIncome} updateCategory={updateCategory} updateItem={updateItem}
      addIncome={vi.fn()} removeIncome={vi.fn()} moveIncome={vi.fn()} addCategory={vi.fn()} removeCategory={vi.fn()} moveCategory={vi.fn()}
      addItem={vi.fn()} removeItem={vi.fn()} moveItem={vi.fn()} updateIncomeColor={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Monthly amount for Salary" }), { target: { value: "3200" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Category name for Housing" }), { target: { value: "Home" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Monthly amount for Rent" }), { target: { value: "920" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Monthly amount for ETF" }), { target: { value: "350" } });
    expect(updateIncome).toHaveBeenCalledWith(0, "value", "3200");
    expect(updateCategory).toHaveBeenCalledWith(1, "name", "Home");
    expect(updateItem).toHaveBeenCalledWith(1, 0, "value", "920");
    expect(updateItem).toHaveBeenCalledWith(0, 0, "value", "350");
  });
});
