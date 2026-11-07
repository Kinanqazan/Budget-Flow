import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChartNoAxesCombined, ChevronLeft, MoreHorizontal, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FinanceData, CategoryType } from "@/types/finance";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

const nameFieldClass = "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-[15px] md:h-7 md:text-[13px] text-foreground outline-none transition-colors hover:bg-accent/50 focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/20";
const actionClass = "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ColorPicker({ color, label, onChange }: { color: string; label: string; onChange: (color: string) => void }) {
  return (
      <label className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md focus-within:ring-2 focus-within:ring-ring" title={label}>
      <input type="color" value={color} onChange={(event) => onChange(event.target.value)} className="sr-only" aria-label={label} />
      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
    </label>
  );
}

const NameEditingContext = createContext({ isMobile: false, editing: false, openMenu: () => {}, stopEditing: () => {} });

function EditableName({ value, onChange, label, className }: { value: string; onChange: (value: string) => void; label: string; className?: string }) {
  const { isMobile, editing, openMenu, stopEditing } = useContext(NameEditingContext);
  if (isMobile && !editing) {
    return <button type="button" className={`${className} text-left truncate`} aria-label={label} aria-haspopup="menu" onClick={openMenu}>{value}</button>;
  }
  return <input className={className} value={value} onChange={(event) => onChange(event.target.value)}
    aria-label={label} onBlur={stopEditing} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />;
}

function RowActions({ name, children, menu, isMobile, amountRow = false }: { name: string; children: ReactNode; menu: ReactNode; isMobile: boolean; amountRow?: boolean }) {
  const [editing, setEditing] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <div
        ref={rowRef}
        className="sidebar-action-row relative min-w-0"

      >
        <NameEditingContext.Provider value={{ isMobile, editing, openMenu: () => setMenuOpen(true), stopEditing: () => setEditing(false) }}>{children}</NameEditingContext.Provider>
        <DropdownMenuTrigger className={`sidebar-row-actions pointer-events-none absolute top-1/2 z-10 flex opacity-0 md:pointer-events-auto md:opacity-100 h-8 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-sidebar text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${amountRow ? "right-[96px] md:right-[84px]" : "right-0"}`} aria-label={`Actions for ${name}`} aria-hidden={isMobile || undefined} tabIndex={isMobile ? -1 : 0} title={`Actions for ${name}`}>
          <MoreHorizontal size={16} aria-hidden="true" />
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent side="right" align="start" className="w-48" onCloseAutoFocus={(event) => {
        if (editing) {
          event.preventDefault();
          window.setTimeout(() => rowRef.current?.querySelector<HTMLInputElement>("input[type=text], input:not([type])")?.focus(), 0);
        }
      }}>
        {isMobile && <DropdownMenuItem onSelect={() => setEditing(true)}><Pencil size={14} /> Rename</DropdownMenuItem>}
        {menu}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BudgetRow({ name, value, onNameChange, onValueChange, menu, isMobile }: {
  isMobile: boolean;
  name: string;
  value: number;
  onNameChange: (name: string) => void;
  onValueChange: (value: string) => void;
  menu: ReactNode;
}) {
  return (
    <RowActions name={name} menu={menu} isMobile={isMobile} amountRow>
      <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-2 md:grid-cols-[minmax(0,1fr)_24px_80px] md:gap-1">
        <EditableName className={nameFieldClass} value={name} onChange={onNameChange} label={`Name for ${name}`} />
        <span className="hidden md:block" aria-hidden="true" />
        <input
          className="h-8 w-full min-w-0 rounded-md border border-border/60 bg-background px-2 text-right text-[15px] md:h-7 md:text-[13px] font-medium tabular-nums text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          type="number" step="0.01" min="0" value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-label={`Monthly amount for ${name}`}
        />
      </div>
    </RowActions>
  );
}

export default function FinanceSidebar({
  data, updateIncome, addIncome, removeIncome, moveIncome,
  updateCategory, addCategory, removeCategory, moveCategory,
  updateItem, addItem, removeItem, moveItem, updateIncomeColor, onClose,
}: Props) {
  const isMobile = useIsMobile();
  const [pendingDelete, setPendingDelete] = useState<{ kind: "income" | "category" | "item"; id: string; name: string; categoryId?: string } | null>(null);
  const categories = data.categories.map((category, index) => ({ category, index }));

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "income") {
      const index = data.income.findIndex((income) => income.id === pendingDelete.id);
      if (index !== -1) removeIncome(index);
    } else {
      const categoryIndex = data.categories.findIndex((category) => category.id === (pendingDelete.kind === "category" ? pendingDelete.id : pendingDelete.categoryId));
      if (categoryIndex === -1) return;
      if (pendingDelete.kind === "category") removeCategory(categoryIndex);
      else {
        const itemIndex = data.categories[categoryIndex].items.findIndex((item) => item.id === pendingDelete.id);
        if (itemIndex !== -1) removeItem(categoryIndex, itemIndex);
      }
    }
  };

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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={addIncome}><Plus size={14} /> Add income</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addCategory("expense")}><Plus size={14} /> Add expense category</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addCategory("investment")}><Plus size={14} /> Add investment category</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button onClick={onClose} className={actionClass} title="Close sidebar" aria-label="Close sidebar"><ChevronLeft size={18} /></button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 py-2.5 md:space-y-3">
        <section className="space-y-1.5" aria-label="Income">
            <div className="flex items-center gap-1">
            <ColorPicker color={data.incomeColor || "#2196F3"} label="Choose income color" onChange={updateIncomeColor} />
              <h2 className="px-2 text-[15px] font-semibold text-foreground md:text-sm">Income</h2>
          </div>
          {data.income.map((income, index) => (
            <BudgetRow isMobile={isMobile} key={income.id} name={income.name} value={income.value} onNameChange={(name) => updateIncome(index, "name", name)} onValueChange={(value) => updateIncome(index, "value", value)} menu={(
              <>
                <DropdownMenuItem disabled={index === 0} onSelect={() => moveIncome(index, index - 1)}><ArrowUp size={14} /> Move up</DropdownMenuItem>
                <DropdownMenuItem disabled={index === data.income.length - 1} onSelect={() => moveIncome(index, index + 1)}><ArrowDown size={14} /> Move down</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive dark:text-red-400 dark:focus:text-red-400" onSelect={() => setPendingDelete({ kind: "income", id: income.id, name: income.name })}><Trash2 size={14} /> Delete income</DropdownMenuItem>
              </>
            )} />
          ))}
        </section>

        {(["expense", "investment"] as const).map((type) => {
          const group = categories.filter(({ category }) => (category.type || "expense") === type);
          if (group.length === 0) return null;
          const label = type === "expense" ? "Expenses" : "Investments";
          return (
            <section key={type} className="space-y-2.5 border-t border-border/60 pt-3 md:space-y-2 md:pt-2" aria-label={label}>
              <h2 className="px-2 text-sm font-semibold text-muted-foreground">{label}</h2>
              {group.map(({ category, index: ci }, groupIndex) => (
                <div key={category.id} className={`space-y-1.5 ${groupIndex > 0 ? "border-t border-border/60 pt-3 md:pt-2" : ""}`}>
                  <RowActions name={category.name} isMobile={isMobile} menu={(
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
                      <DropdownMenuItem className="text-destructive focus:text-destructive dark:text-red-400 dark:focus:text-red-400" onSelect={() => setPendingDelete({ kind: "category", id: category.id, name: category.name })}><Trash2 size={14} /> Delete category</DropdownMenuItem>
                    </>
                  )}>
                    <div className="flex items-center gap-1 md:pr-6">
                      <ColorPicker color={category.color} label={`Choose color for ${category.name}`} onChange={(color) => updateCategory(ci, "color", color)} />
                      <EditableName className={`${nameFieldClass} flex-1 font-semibold`} value={category.name} onChange={(name) => updateCategory(ci, "name", name)} label={`Category name for ${category.name}`} />
                    </div>
                  </RowActions>
                  {category.items.map((item, ii) => (
                    <BudgetRow isMobile={isMobile} key={item.id} name={item.name} value={item.value} onNameChange={(name) => updateItem(ci, ii, "name", name)} onValueChange={(value) => updateItem(ci, ii, "value", value)} menu={(
                      <>
                        <DropdownMenuItem disabled={ii === 0} onSelect={() => moveItem(ci, ii, ii - 1)}><ArrowUp size={14} /> Move up</DropdownMenuItem>
                        <DropdownMenuItem disabled={ii === category.items.length - 1} onSelect={() => moveItem(ci, ii, ii + 1)}><ArrowDown size={14} /> Move down</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive dark:text-red-400 dark:focus:text-red-400" onSelect={() => setPendingDelete({ kind: "item", id: item.id, name: item.name, categoryId: category.id })}><Trash2 size={14} /> Delete item</DropdownMenuItem>
                      </>
                    )} />
                  ))}
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "category"
                ? <>Delete “{pendingDelete.name}” and all of its items? This cannot be undone.</>
                : <>Delete “{pendingDelete?.name}”? This cannot be undone.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
