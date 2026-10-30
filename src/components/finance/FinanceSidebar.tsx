import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from "react";
import { ArrowDown, ArrowUp, ChartNoAxesCombined, ChevronLeft, Plus, Receipt, Trash2 } from "lucide-react";
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

const nameFieldClass = "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-[15px] text-foreground outline-none transition-colors hover:bg-accent/50 focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/20";
const actionClass = "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ColorPicker({ color, label, onChange }: { color: string; label: string; onChange: (color: string) => void }) {
  return (
      <label className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md focus-within:ring-2 focus-within:ring-ring" title={label}>
      <input type="color" value={color} onChange={(event) => onChange(event.target.value)} className="sr-only" aria-label={label} />
      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
    </label>
  );
}

function PressHoldActions({ name, children, menu }: { name: string; children: ReactNode; menu: ReactNode }) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<[number, number] | null>(null);
  const openedByHold = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => clearTimer, []);

  const openMenu = () => {
    if (openedByHold.current) return;
    openedByHold.current = true;
    clearTimer();
    setMenuOpen(true);
  };

  const beginHold = (target: EventTarget | null, x: number, y: number, button = 0) => {
    if (!(target instanceof Element) || button !== 0 || target.closest("button, label, input, textarea, select")) return;
    clearTimer();
    startRef.current = [x, y];
    timerRef.current = window.setTimeout(openMenu, 500);
  };

  const cancelMovedHold = (x: number, y: number) => {
    const start = startRef.current;
    if (start && Math.hypot(x - start[0], y - start[1]) > 8) {
      startRef.current = null;
      clearTimer();
    }
  };

  const handlePointerUp = () => {
    startRef.current = null;
    clearTimer();
    if (openedByHold.current) window.setTimeout(() => { openedByHold.current = false; }, 300);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    openMenu();
    window.setTimeout(() => { openedByHold.current = false; }, 300);
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <div
        className="relative"
        onPointerDown={(event) => beginHold(event.target, event.clientX, event.clientY, event.button)}
        onTouchStart={(event: ReactTouchEvent<HTMLDivElement>) => {
          const touch = event.touches[0];
          if (touch) beginHold(event.target, touch.clientX, touch.clientY);
        }}
        onPointerMove={(event) => cancelMovedHold(event.clientX, event.clientY)}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (touch) cancelMovedHold(touch.clientX, touch.clientY);
        }}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
        onClick={(event) => {
          if (!openedByHold.current) return;
          event.preventDefault();
          event.stopPropagation();
          openedByHold.current = false;
        }}
      >
        {children}
        <DropdownMenuTrigger className="pointer-events-none absolute right-1 top-1/2 h-px w-px -translate-y-1/2 overflow-hidden opacity-0" aria-label={`Actions for ${name}`}>
          Actions
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent side="right" align="start" className="w-48">{menu}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function BudgetRow({ name, value, onNameChange, onValueChange, menu }: {
  name: string;
  value: number;
  onNameChange: (name: string) => void;
  onValueChange: (value: string) => void;
  menu: ReactNode;
}) {
  return (
    <PressHoldActions name={name} menu={menu}>
      <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-2">
        <input className={nameFieldClass} value={name} onChange={(event) => onNameChange(event.target.value)} aria-label={`Name for ${name}`} title="Click to edit; press and hold the row for actions" />
        <input
          className="h-8 w-full min-w-0 rounded-md border border-border/60 bg-background px-2 text-right text-[15px] font-medium tabular-nums text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          type="number" step="0.01" min="0" value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-label={`Monthly amount for ${name}`}
        />
      </div>
    </PressHoldActions>
  );
}

export default function FinanceSidebar({
  data, updateIncome, addIncome, removeIncome, moveIncome,
  updateCategory, addCategory, removeCategory, moveCategory,
  updateItem, addItem, removeItem, moveItem, updateIncomeColor, onClose,
}: Props) {
  const categories = data.categories.map((category, index) => ({ category, index }));

  return (
    <aside className="flex h-full w-[320px] min-w-[320px] flex-col border-r border-border/60 bg-sidebar" aria-label="Budget editor">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-6 w-6 shrink-0" />
          <h1 className="min-w-0 text-base font-semibold tracking-tight text-foreground">BudgetFlow</h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={actionClass} title="Add income or category" aria-label="Add income or category"><Plus size={18} /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={addIncome}><Plus size={14} /> Add income</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addCategory("expense")}><Plus size={14} /> Add expense category</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addCategory("investment")}><Plus size={14} /> Add investment category</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button onClick={onClose} className={actionClass} title="Close sidebar" aria-label="Close sidebar"><ChevronLeft size={18} /></button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 py-2.5">
        <section className="space-y-1.5" aria-label="Income">
            <div className="flex items-center gap-1">
            <ColorPicker color={data.incomeColor || "#2196F3"} label="Choose income color" onChange={updateIncomeColor} />
              <h2 className="px-2 text-[15px] font-semibold text-foreground">Income</h2>
          </div>
          {data.income.map((income, index) => (
            <BudgetRow key={income.id} name={income.name} value={income.value} onNameChange={(name) => updateIncome(index, "name", name)} onValueChange={(value) => updateIncome(index, "value", value)} menu={(
              <>
                <DropdownMenuItem disabled={index === 0} onSelect={() => moveIncome(index, index - 1)}><ArrowUp size={14} /> Move up</DropdownMenuItem>
                <DropdownMenuItem disabled={index === data.income.length - 1} onSelect={() => moveIncome(index, index + 1)}><ArrowDown size={14} /> Move down</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive dark:text-red-400 dark:focus:text-red-400" onSelect={() => {
                  if (window.confirm(`Delete income "${income.name}"?`)) removeIncome(index);
                }}><Trash2 size={14} /> Delete income</DropdownMenuItem>
              </>
            )} />
          ))}
        </section>

        {(["expense", "investment"] as const).map((type) => {
          const group = categories.filter(({ category }) => (category.type || "expense") === type);
          if (group.length === 0) return null;
          const label = type === "expense" ? "Expenses" : "Investments";
          return (
            <section key={type} className="space-y-2.5 border-t border-border/60 pt-3" aria-label={label}>
              <h2 className="px-2 text-sm font-semibold text-muted-foreground">{label}</h2>
              {group.map(({ category, index: ci }, groupIndex) => (
                <div key={category.id} className={`space-y-1.5 ${groupIndex > 0 ? "border-t border-border/60 pt-3" : ""}`}>
                  <PressHoldActions name={category.name} menu={(
                    <>
                      <DropdownMenuItem onSelect={() => addItem(ci)}><Plus size={14} /> Add item</DropdownMenuItem>
                      <DropdownMenuItem disabled={groupIndex === 0} onSelect={() => moveCategory(ci, group[groupIndex - 1].index)}><ArrowUp size={14} /> Move up</DropdownMenuItem>
                      <DropdownMenuItem disabled={groupIndex === group.length - 1} onSelect={() => moveCategory(ci, group[groupIndex + 1].index)}><ArrowDown size={14} /> Move down</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => updateCategory(ci, "type", type === "expense" ? "investment" : "expense")}>
                        {type === "expense" ? <ChartNoAxesCombined size={14} /> : <Receipt size={14} />}
                        {type === "expense" ? "Move to investments" : "Move to expenses"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive dark:text-red-400 dark:focus:text-red-400" onSelect={() => {
                        if (window.confirm(`Delete category "${category.name}" and all its items?`)) removeCategory(ci);
                      }}><Trash2 size={14} /> Delete category</DropdownMenuItem>
                    </>
                  )}>
                    <div className="flex items-center gap-1">
                      <ColorPicker color={category.color} label={`Choose color for ${category.name}`} onChange={(color) => updateCategory(ci, "color", color)} />
                      <input className={`${nameFieldClass} flex-1 font-semibold`} value={category.name} onChange={(event) => updateCategory(ci, "name", event.target.value)} aria-label={`Category name for ${category.name}`} title="Click to edit; press and hold the row for actions" />
                    </div>
                  </PressHoldActions>
                  {category.items.map((item, ii) => (
                    <BudgetRow key={item.id} name={item.name} value={item.value} onNameChange={(name) => updateItem(ci, ii, "name", name)} onValueChange={(value) => updateItem(ci, ii, "value", value)} menu={(
                      <>
                        <DropdownMenuItem disabled={ii === 0} onSelect={() => moveItem(ci, ii, ii - 1)}><ArrowUp size={14} /> Move up</DropdownMenuItem>
                        <DropdownMenuItem disabled={ii === category.items.length - 1} onSelect={() => moveItem(ci, ii, ii + 1)}><ArrowDown size={14} /> Move down</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive dark:text-red-400 dark:focus:text-red-400" onSelect={() => {
                          if (window.confirm(`Delete item "${item.name}"?`)) removeItem(ci, ii);
                        }}><Trash2 size={14} /> Delete item</DropdownMenuItem>
                      </>
                    )} />
                  ))}
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
