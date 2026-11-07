// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("Sidebar item creation", () => {
  it("adds an item from the selected expense or investment category menu", () => {
    const addItem = vi.fn();
    render(<FinanceSidebar data={data} updateIncome={vi.fn()} updateCategory={vi.fn()} updateItem={vi.fn()}
      addIncome={vi.fn()} removeIncome={vi.fn()} moveIncome={vi.fn()} addCategory={vi.fn()} removeCategory={vi.fn()} moveCategory={vi.fn()}
      addItem={addItem} removeItem={vi.fn()} moveItem={vi.fn()} updateIncomeColor={vi.fn()} onClose={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Housing" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Add item" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Savings" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Add item" }));
    expect(addItem.mock.calls).toEqual([[1], [0]]);
  });
});

describe("Sidebar actions", () => {
  it("removes an item and a category through their action menus after confirmation", () => {
    const removeItem = vi.fn();
    const removeCategory = vi.fn();
    render(<FinanceSidebar data={data} updateIncome={vi.fn()} updateCategory={vi.fn()} updateItem={vi.fn()}
      addIncome={vi.fn()} removeIncome={vi.fn()} moveIncome={vi.fn()} addCategory={vi.fn()} removeCategory={removeCategory} moveCategory={vi.fn()}
      addItem={vi.fn()} removeItem={removeItem} moveItem={vi.fn()} updateIncomeColor={vi.fn()} onClose={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Rent" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete item" }));
    expect(removeItem).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog").textContent).toContain("Rent");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(removeItem).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Rent" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete item" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
    expect(removeItem).toHaveBeenCalledWith(1, 0);
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Housing" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete category" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("all of its items");
    fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
    expect(removeCategory).toHaveBeenCalledWith(1);
  });
});

describe("Phone sidebar actions", () => {
  it("opens actions on tap and enables renaming from the menu", async () => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const updateItem = vi.fn();
    render(<FinanceSidebar data={data} updateIncome={vi.fn()} updateCategory={vi.fn()} updateItem={updateItem}
      addIncome={vi.fn()} removeIncome={vi.fn()} moveIncome={vi.fn()} addCategory={vi.fn()} removeCategory={vi.fn()} moveCategory={vi.fn()}
      addItem={vi.fn()} removeItem={vi.fn()} moveItem={vi.fn()} updateIncomeColor={vi.fn()} onClose={vi.fn()} />);
    const nameButton = screen.getByRole("button", { name: "Name for Rent" });
    fireEvent.click(nameButton);
    const rename = await screen.findByRole("menuitem", { name: "Rename" });
    fireEvent.click(rename);
    const name = screen.getByRole("textbox", { name: "Name for Rent" }) as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(name));
    fireEvent.change(name, { target: { value: "New rent" } });
    expect(updateItem).toHaveBeenCalledWith(1, 0, "name", "New rent");
    fireEvent.blur(name);
    expect(screen.getByRole("button", { name: "Name for Rent" })).toBeTruthy();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
  });
});

describe("Percentage display", () => {
  it("does not select the entire field when table or sidebar inputs receive focus", () => {
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    const table = render(<FinanceTable data={data} stats={stats} currency="€" showPercent={false} updateItem={vi.fn()} removeItem={vi.fn()} />);
    table.container.querySelectorAll<HTMLInputElement>('input[type="number"], input:not([type])').forEach((input) => fireEvent.focus(input));
    table.unmount();
    const sidebar = render(<FinanceSidebar data={data} updateIncome={vi.fn()} updateCategory={vi.fn()} updateItem={vi.fn()}
      addIncome={vi.fn()} removeIncome={vi.fn()} moveIncome={vi.fn()} addCategory={vi.fn()} removeCategory={vi.fn()} moveCategory={vi.fn()}
      addItem={vi.fn()} removeItem={vi.fn()} moveItem={vi.fn()} updateIncomeColor={vi.fn()} onClose={vi.fn()} />);
    sidebar.container.querySelectorAll<HTMLInputElement>('input[type="number"], input:not([type])').forEach((input) => fireEvent.focus(input));
    expect(select).not.toHaveBeenCalled();
    select.mockRestore();
  });
  it("shows the phone flow as percentages, expands items, and switches to money values", () => {
    const view = render(<MobileAllocation data={data} stats={stats} />);
    const tree = screen.getByRole("group", { name: "Money flow tree" });
    expect(tree.textContent).toContain("100%");
    expect(tree.textContent).toContain("50%");
    expect(tree.textContent).not.toContain("€");
    expect(screen.queryByRole("region", { name: "Budget summary" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("button", { name: /Housing: 30%/ }), { key: "Enter" });
    expect(screen.getByRole("list", { name: "Housing items" }).textContent).toContain("Rent");
    view.rerender(<MobileAllocation data={data} stats={stats} showPercent={false} />);
    expect(tree.textContent).toContain("900 €");
    expect(tree.textContent).not.toContain("30%");
    const noIncome = { ...data, income: [] };
    view.rerender(<MobileAllocation data={noIncome} stats={calculateStats(noIncome)} />);
    expect(screen.getByText("Add income to see how it flows into your categories.")).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/€|Infinity|NaN/);
  });

  it("shows analysis percentages by default and restores monthly and annual amounts on request", () => {
    const view = render(<AnalysisPanel stats={stats} currency="€" />);
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("30%")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Savings 10%" })).toBeTruthy();
    expect(screen.queryByText("75%")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "annual" }));
    expect(screen.getByRole("button", { name: "Savings 10%" })).toBeTruthy();
    view.rerender(<AnalysisPanel stats={stats} currency="€" showPercent={false} />);
    expect(screen.getAllByText("monthly")).toHaveLength(1);
    expect(screen.getAllByText("annual")).toHaveLength(1);
    expect(screen.getByRole("button", { name: `Savings ${Number(3600).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "monthly" }));
    expect(screen.getByRole("button", { name: `Savings ${Number(300).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` })).toBeTruthy();
    expect(view.container.textContent).toContain("€");
    expect(screen.queryByText("30%")).toBeNull();
  });

  it("uses the overall budget for analysis investment categories and their items", () => {
    const investmentData: FinanceData = {
      income: [{ id: "income", name: "Salary", value: 3500 }],
      categories: [{
        id: "investments", name: "Savings & Investments", type: "investment", color: "#8b5cf6",
        items: [{ id: "etf", name: "ETF Plan", value: 500 }, { id: "savings", name: "Savings Account", value: 200 }],
      }],
    };
    const view = render(<AnalysisPanel stats={calculateStats(investmentData)} currency="€" />);
    const category = screen.getByRole("button", { name: "Savings & Investments 20%" });
    expect(category.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(category);
    expect(screen.getByText("ETF Plan").parentElement?.textContent).toBe("ETF Plan14%");
    expect(screen.getByText("Savings Account").parentElement?.textContent).toBe("Savings Account6%");
    view.rerender(<AnalysisPanel stats={calculateStats({ ...investmentData, income: [] })} currency="€" />);
    expect(screen.getByRole("button", { name: "Savings & Investments 0%" })).toBeTruthy();
    expect(screen.getByText("ETF Plan").parentElement?.textContent).toBe("ETF Plan0%");
    expect(view.container.textContent).not.toMatch(/Infinity|NaN/);
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
