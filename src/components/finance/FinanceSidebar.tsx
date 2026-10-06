import { Fragment } from "react";
import { ArrowDown, ArrowUp, ChartNoAxesCombined, ChevronLeft, CircleDollarSign, MoreHorizontal, Plus, Receipt, Trash2, TrendingUp } from "lucide-react";
import type { FinanceData, CategoryType } from "@/types/finance";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  data: FinanceData;
  updateIncome: (i: number, f: "name" | "value", v: string | number) => void;
  addIncome: () => void;
  removeIncome: (i: number) => void;
  moveIncome: (fromIndex: number, toIndex: number) => void;
  updateCategory: (ci: number, f: "name" | "color" | "type", v: string) => void;
  addCategory: (type?: CategoryType) => void;
  removeCategory: (ci: number) => void;
  moveCategory: (fromIndex: number, toIndex: number) => void;
  updateItem: (ci: number, ii: number, f: "name" | "value", v: string | number) => void;
  addItem: (ci: number) => void;
  removeItem: (ci: number, ii: number) => void;
  moveItem: (ci: number, fromIndex: number, toIndex: number) => void;
  updateIncomeColor: (color: string) => void;
  onClose: () => void;
}

export default function FinanceSidebar({
  data, updateIncome, addIncome, removeIncome, moveIncome,
  updateCategory, addCategory, removeCategory, moveCategory,
  updateItem, addItem, removeItem, moveItem, updateIncomeColor, onClose,
}: Props) {
  const orderedCategories = data.categories
    .map((category, index) => ({ category, index, type: (category.type || "expense") as CategoryType }))
    .sort((a, b) => Number(a.type === "investment") - Number(b.type === "investment"));

  return (
    <aside className="w-[280px] min-w-[280px] bg-background flex flex-col h-screen border-r border-border/60">
      {/* Header / Logo */}
      <div className="px-5 py-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp size={16} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">BudgetFlow</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">Your financial overview</p>
          </div>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                title="Add category"
                aria-label="Add category"
              >
                <Plus size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={addIncome}><Plus size={14} /> Add as income</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => addCategory("expense")}><Plus size={14} /> Add as expense</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => addCategory("investment")}><Plus size={14} /> Add as investment</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2.5 py-3 space-y-3">
        {data.income.map((inc, i) => (
          <div key={inc.id} className="grid grid-cols-[20px_minmax(0,1fr)_64px_24px] items-center gap-1 group mb-1 border-b border-border/40 pb-1">
            <label className="relative flex h-6 w-5 cursor-pointer items-center justify-center text-emerald-500 hover:text-emerald-400" title="Choose income color">
              <input
                type="color"
                value={data.incomeColor || "#2196F3"}
                onChange={(e) => updateIncomeColor(e.target.value)}
                className="sr-only"
              />
              <CircleDollarSign size={15} style={{ color: data.incomeColor || "#2196F3" }} />
            </label>
            <input
              className="w-full text-xs px-2 py-1 rounded-md border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all min-w-0"
              value={inc.name}
              onChange={(e) => updateIncome(i, "name", e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            <input
              className="w-full text-xs px-2 py-1 rounded-md border border-border/60 bg-background text-foreground text-right focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all"
              type="number"
              step="0.01"
              min="0"
              value={inc.value}
              onChange={(e) => updateIncome(i, "value", e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Income actions" aria-label={`Actions for ${inc.name}`}>
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem disabled={i === 0} onSelect={() => moveIncome(i, i - 1)}><ArrowUp size={14} /> Move up</DropdownMenuItem>
                <DropdownMenuItem disabled={i === data.income.length - 1} onSelect={() => moveIncome(i, i + 1)}><ArrowDown size={14} /> Move down</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => {
                  if (window.confirm(`Delete income "${inc.name}"?`)) removeIncome(i);
                }}><Trash2 size={14} /> Delete income</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {/* Expense and investment categories, kept in type order */}
        {orderedCategories.map(({ category: cat, index: ci, type }, categoryIndex) => (
          <Fragment key={cat.id}>
          {categoryIndex === 0 || orderedCategories[categoryIndex - 1].type !== type ? (
            <div className="mt-2 border-t border-border/60 pt-3" aria-hidden="true" />
          ) : null}
          <div className="pb-2">
            <div
              className="flex items-center gap-1.5 pb-1 mb-1 border-b-2 group"
              style={{ borderBottomColor: cat.color }}
            >
              {type === "investment" ? (
                <label className="relative flex h-6 w-5 cursor-pointer items-center justify-center text-violet-500 hover:text-violet-400" title="Choose investment color">
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) => updateCategory(ci, "color", e.target.value)}
                    className="sr-only"
                  />
                  <ChartNoAxesCombined size={14} style={{ color: cat.color }} />
                </label>
              ) : (
                <label className="relative flex h-6 w-5 cursor-pointer items-center justify-center text-primary hover:text-primary/80" title="Choose expense color">
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) => updateCategory(ci, "color", e.target.value)}
                    className="sr-only"
                  />
                  <Receipt size={14} style={{ color: cat.color }} />
                </label>
              )}
              <input
                className="flex-1 text-xs font-bold text-foreground bg-transparent border-none outline-none min-w-0"
                value={cat.name}
                onChange={(e) => updateCategory(ci, "name", e.target.value)}
                onFocus={(e) => e.target.select()}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Category actions" aria-label={`Actions for ${cat.name}`}>
                    <MoreHorizontal size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onSelect={() => addItem(ci)}><Plus size={14} /> Add item</DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={categoryIndex === 0 || orderedCategories[categoryIndex - 1].type !== type}
                    onSelect={() => moveCategory(ci, orderedCategories[categoryIndex - 1].index)}
                  ><ArrowUp size={14} /> Move up</DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={categoryIndex === orderedCategories.length - 1 || orderedCategories[categoryIndex + 1].type !== type}
                    onSelect={() => moveCategory(ci, orderedCategories[categoryIndex + 1].index)}
                  ><ArrowDown size={14} /> Move down</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => updateCategory(ci, "type", "expense")}>
                    <Receipt size={14} /> Set as expense
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => updateCategory(ci, "type", "investment")}>
                    <ChartNoAxesCombined size={14} /> Set as investment
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => {
                    if (window.confirm(`Delete category "${cat.name}" and all its items?`)) removeCategory(ci);
                  }}><Trash2 size={14} /> Delete category</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {cat.items.map((item, ii) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_64px_24px] items-center gap-1 ml-2 my-0.5 group">
                <input
                  className="w-full text-xs px-2 py-1 rounded-md border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all min-w-0"
                  value={item.name}
                  onChange={(e) => updateItem(ci, ii, "name", e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
                <input
                  className="w-full text-xs px-2 py-1 rounded-md border border-border/60 bg-background text-foreground text-right focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all"
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.value}
                  onChange={(e) => updateItem(ci, ii, "value", e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Item actions" aria-label={`Actions for ${item.name}`}>
                      <MoreHorizontal size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem disabled={ii === 0} onSelect={() => moveItem(ci, ii, ii - 1)}><ArrowUp size={14} /> Move up</DropdownMenuItem>
                    <DropdownMenuItem disabled={ii === cat.items.length - 1} onSelect={() => moveItem(ci, ii, ii + 1)}><ArrowDown size={14} /> Move down</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => {
                      if (window.confirm(`Delete item "${item.name}"?`)) removeItem(ci, ii);
                    }}><Trash2 size={14} /> Delete item</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {/* Removed add item block button */}
          </div>
          </Fragment>
        ))}
      </div>
    </aside>
  );
}
