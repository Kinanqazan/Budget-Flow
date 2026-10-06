import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FinanceData, ExpenseItem, Stats, CategoryType } from "@/types/finance";
import { 
  AlertTriangle, Armchair, BadgeDollarSign, Bike, Brain, BriefcaseBusiness, Car, Circle, Clock, Coffee,
  Dumbbell, Gamepad2, GraduationCap, HeartPulse, Home, Music, Plane, ShieldCheck, ShoppingBag,
  CheckCircle, ChartNoAxesCombined, Palette, ShoppingCart, SmilePlus, Smartphone, Trash2, Tv, Utensils, Wifi, Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  data: FinanceData;
  stats: Stats;
  updateItem: (ci: number, ii: number, field: keyof ExpenseItem, val: string | number | undefined) => void;
  removeItem: (ci: number, ii: number) => void;
  currency: string;
}

interface FlattenedItem {
  categoryIndex: number;
  itemIndex: number;
  categoryName: string;
  categoryColor: string;
  categoryType: CategoryType;
  item: ExpenseItem;
}

const itemIcons: Record<string, LucideIcon> = {
  shopping: ShoppingCart,
  shoppingBag: ShoppingBag,
  home: Home,
  car: Car,
  bike: Bike,
  food: Utensils,
  coffee: Coffee,
  phone: Smartphone,
  internet: Wifi,
  tv: Tv,
  music: Music,
  games: Gamepad2,
  travel: Plane,
  health: HeartPulse,
  insurance: ShieldCheck,
  dental: SmilePlus,
  brain: Brain,
  electricity: Zap,
  investment: BadgeDollarSign,
  chart: ChartNoAxesCombined,
  fitness: Dumbbell,
  education: GraduationCap,
  work: BriefcaseBusiness,
  furniture: Armchair,
};

const iconChoices = Object.entries(itemIcons);

const withAlpha = (color: string, alpha: number) => {
  const hex = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return color;
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const TABLE_COLUMN_WIDTHS_KEY = "budgetflow-table-column-widths";
const MOBILE_TABLE_COLUMN_WIDTHS_KEY = "budgetflow-mobile-table-column-widths";
const TABLE_CATEGORY_COLORS_KEY = "budgetflow-table-category-colors";
const defaultColumnWidths: Record<string, number> = {
  name: 180,
  monthly: 110,
  annual: 110,
  percentage: 64,
  dates: 230,
  infos: 150,
  actions: 50,
};

const mobileColumnWidths: Record<string, number> = {
  name: 180,
  monthly: 100,
  annual: 100,
  percentage: 60,
  dates: 190,
  infos: 150,
  actions: 44,
};

const loadColumnWidths = (storageKey: string, defaults: Record<string, number>) => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return defaults;

    const parsed = JSON.parse(saved) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(defaults).map(([column, defaultWidth]) => [
        column,
        typeof parsed[column] === "number" && parsed[column] >= 50 ? parsed[column] : defaultWidth,
      ])
    );
  } catch {
    return defaults;
  }
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const convertDateToISO = (dateStr: string): string | undefined => {
  if (!dateStr) return undefined;
  const delimiter = dateStr.includes('/') ? '/' : (dateStr.includes('.') ? '.' : '-');
  const parts = dateStr.split(delimiter);
  if (parts.length === 3) {
    const dayStr = parts[0].trim();
    const monthStr = parts[1].trim();
    const yearStr = parts[2].trim();

    const dayVal = parseInt(dayStr, 10);
    const monthVal = parseInt(monthStr, 10);
    const yearVal = parseInt(yearStr, 10);

    if (isNaN(dayVal) || isNaN(monthVal) || isNaN(yearVal)) return undefined;
    if (dayVal < 1 || dayVal > 31) return undefined;
    if (monthVal < 1 || monthVal > 12) return undefined;
    if (yearStr.length !== 2 && yearStr.length !== 4) return undefined;

    const day = dayVal.toString().padStart(2, '0');
    const month = monthVal.toString().padStart(2, '0');
    const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;

    return `${year}-${month}-${day}`;
  }
  return undefined;
};

const formatDateForDisplay = (isoStr?: string): string => {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return isoStr;
};

const calculateNoticeDate = (endDateStr?: string, noticePeriodStr?: string): string | undefined => {
  if (!endDateStr || !noticePeriodStr || noticePeriodStr === "none" || noticePeriodStr === "custom") {
    return undefined;
  }
  const months = parseInt(noticePeriodStr, 10);
  if (isNaN(months) || months <= 0) return undefined;

  const date = new Date(endDateStr);
  if (isNaN(date.getTime())) return undefined;

  const targetDay = date.getDate();
  // Subtract months safely
  date.setMonth(date.getMonth() - months);
  
  // Prevent date overflow/wrapping (e.g. May 31 minus 3 months becomes March 3 instead of Feb 28/29)
  if (date.getDate() < targetDay) {
    date.setDate(0);
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function FinanceTable({
  data,
  stats,
  updateItem,
  removeItem,
  currency,
}: Props) {
  const isMobile = useIsMobile();
  const [activeDateEditorItemId, setActiveDateEditorItemId] = useState<string | null>(null);
  const [iconPickerItemId, setIconPickerItemId] = useState<string | null>(null);
  const [datePopoverPos, setDatePopoverPos] = useState<{ top: number; left: number } | null>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  const [columns, setColumns] = useState<string[]>([
    "name",
    "monthly",
    "annual",
    "percentage",
    "dates",
    "infos",
    "actions",
  ]);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => loadColumnWidths(TABLE_COLUMN_WIDTHS_KEY, defaultColumnWidths));
  const [mobileColWidths, setMobileColWidths] = useState<Record<string, number>>(() => loadColumnWidths(MOBILE_TABLE_COLUMN_WIDTHS_KEY, mobileColumnWidths));
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [colorRows, setColorRows] = useState(() => {
    try {
      return localStorage.getItem(TABLE_CATEGORY_COLORS_KEY) === "true";
    } catch {
      return false;
    }
  });

  const getColumnWidth = (column: string) => (isMobile ? mobileColWidths[column] : colWidths[column]);
  const formatPercentage = (value: number) =>
    stats.income > 0 ? `${Math.round((value / stats.income) * 100)}%` : "0%";

  useEffect(() => {
    localStorage.setItem(TABLE_COLUMN_WIDTHS_KEY, JSON.stringify(colWidths));
  }, [colWidths]);

  useEffect(() => {
    localStorage.setItem(MOBILE_TABLE_COLUMN_WIDTHS_KEY, JSON.stringify(mobileColWidths));
  }, [mobileColWidths]);

  useEffect(() => {
    localStorage.setItem(TABLE_CATEGORY_COLORS_KEY, String(colorRows));
  }, [colorRows]);

  useEffect(() => {
    if (!iconPickerItemId) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setIconPickerItemId(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [iconPickerItemId]);

  const startResize = (e: React.PointerEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const pointerId = e.pointerId;
    const activeWidths = isMobile ? mobileColWidths : colWidths;
    const startWidth = activeWidths[col] || 100;

    const doDrag = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const deltaX = moveEvent.clientX - startX;
      const updateWidths = isMobile ? setMobileColWidths : setColWidths;
      updateWidths((prev) => ({ ...prev, [col]: Math.max(50, startWidth + deltaX) }));
    };

    const stopDrag = () => {
      document.removeEventListener("pointermove", doDrag);
      document.removeEventListener("pointerup", stopDrag);
      document.removeEventListener("pointercancel", stopDrag);
    };

    document.addEventListener("pointermove", doDrag);
    document.addEventListener("pointerup", stopDrag);
    document.addEventListener("pointercancel", stopDrag);
  };

  // Local state to hold the formatted date strings (DD.MM.YYYY) while typing
  const [tempDates, setTempDates] = useState<{
    startDate: string;
    endDate: string;
    cancellationDate: string;
  } | null>(null);

  // Local state to buffer numeric inputs while typing to prevent focus jumps or snapping to zero
  const [editingValue, setEditingValue] = useState<{ id: string; field: "monthly" | "annual"; val: string } | null>(null);

  // Sync tempDates only when the editor opens/closes
  const openDateEditor = (item: ExpenseItem, buttonEl?: HTMLElement) => {
    setActiveDateEditorItemId(item.id);
    setTempDates({
      startDate: formatDateForDisplay(item.startDate),
      endDate: formatDateForDisplay(item.endDate),
      cancellationDate: formatDateForDisplay(item.cancellationDate),
    });
    if (buttonEl) {
      const rect = buttonEl.getBoundingClientRect();
      setDatePopoverPos({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - 260),
      });
    }
  };

  const closeDateEditor = () => {
    setActiveDateEditorItemId(null);
    setTempDates(null);
    setDatePopoverPos(null);
  };

  useLayoutEffect(() => {
    if (!activeDateEditorItemId || !datePopoverPos || !datePopoverRef.current) return;

    const popover = datePopoverRef.current.getBoundingClientRect();
    const padding = 8;
    const maxTop = Math.max(padding, window.innerHeight - popover.height - padding);
    const maxLeft = Math.max(padding, window.innerWidth - popover.width - padding);
    const top = Math.min(Math.max(datePopoverPos.top, padding), maxTop);
    const left = Math.min(Math.max(datePopoverPos.left, padding), maxLeft);

    if (top !== datePopoverPos.top || left !== datePopoverPos.left) {
      setDatePopoverPos({ top, left });
    }
  }, [activeDateEditorItemId, datePopoverPos]);

  const handleTempDateChange = (
    field: "startDate" | "endDate" | "cancellationDate",
    rawValue: string,
    item: ExpenseItem,
    ci: number,
    ii: number
  ) => {
    // Update local state so typing is smooth
    setTempDates((prev) => {
      const current = prev || { startDate: "", endDate: "", cancellationDate: "" };
      return { ...current, [field]: rawValue };
    });

    // Try to parse and update parent if valid
    const iso = convertDateToISO(rawValue);
    if (iso) {
      updateItem(ci, ii, field, iso);

      // If end date changes and there's a notice period, recalculate cancellation date
      if (field === "endDate" && item.noticePeriod && item.noticePeriod !== "none" && item.noticePeriod !== "custom") {
        const calcDate = calculateNoticeDate(iso, item.noticePeriod);
        if (calcDate) {
          updateItem(ci, ii, "cancellationDate", calcDate);
          setTempDates((prev) => {
            const current = prev || { startDate: "", endDate: "", cancellationDate: "" };
            return { ...current, cancellationDate: formatDateForDisplay(calcDate) };
          });
        }
      }
    } else if (rawValue === "") {
      // If cleared, update parent with undefined
      updateItem(ci, ii, field, undefined);
      if (field === "endDate" && item.noticePeriod && item.noticePeriod !== "none" && item.noticePeriod !== "custom") {
        updateItem(ci, ii, "cancellationDate", undefined);
        setTempDates((prev) => {
          const current = prev || { startDate: "", endDate: "", cancellationDate: "" };
          return { ...current, cancellationDate: "" };
        });
      }
    }
  };

  // Flatten nested items for tabular display, keeping expenses and investments in separate sections.
  const flattenedItems = useMemo(() => {
    const list: FlattenedItem[] = [];
    data.categories.forEach((category, ci) => {
      const catLower = category.name.toLowerCase();
      if (category.type !== "investment" && (catLower === "income" || catLower === "salary" || catLower.includes("salary") || catLower.includes("income"))) {
        return;
      }
      category.items.forEach((item, ii) => {
        const itemLower = item.name.toLowerCase();
        if (category.type !== "investment" && (itemLower === "income" || itemLower === "salary" || itemLower.includes("salary") || itemLower.includes("income"))) {
          return;
        }
        list.push({
          categoryIndex: ci,
          itemIndex: ii,
          categoryName: category.name,
          categoryColor: category.color,
          categoryType: category.type || "expense",
          item,
        });
      });
    });
    return list.sort((a, b) => Number(a.categoryType === "investment") - Number(b.categoryType === "investment"));
  }, [data.categories]);

  // Notice alerts configuration
  const noticeAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return flattenedItems
      .filter((fi) => fi.item.cancellationDate)
      .map((fi) => {
        const target = new Date(fi.item.cancellationDate!);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...fi, diffDays };
      })
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [flattenedItems]);

  const activeWarnings = useMemo(() => {
    return noticeAlerts.filter((alert) => alert.diffDays <= 90);
  }, [noticeAlerts]);

  const warningStatuses = useMemo(() => {
    const statuses = new Map<string, { label: string; tone: "destructive" | "warning" | "muted"; count: number }>();
    activeWarnings.forEach((warning) => {
      const expired = warning.diffDays < 0;
      const urgent = warning.diffDays >= 0 && warning.diffDays <= 30;
      const key = expired ? "expired" : urgent ? "urgent" : "upcoming";
      const label = expired ? "Expired" : urgent ? "Urgent" : "Upcoming";
      const tone = expired ? "muted" : urgent ? "destructive" : "warning";
      const current = statuses.get(key);
      statuses.set(key, { label, tone, count: (current?.count || 0) + 1 });
    });
    return Array.from(statuses.values());
  }, [activeWarnings]);

  const totals = useMemo(() => {
    const expenseMonthly = flattenedItems
      .filter((fi) => fi.categoryType === "expense")
      .reduce((sum, fi) => sum + (fi.item.value || 0), 0);
    const investmentMonthly = flattenedItems
      .filter((fi) => fi.categoryType === "investment")
      .reduce((sum, fi) => sum + (fi.item.value || 0), 0);
    return {
      expenses: {
        monthly: Math.round(expenseMonthly * 100) / 100,
        annual: Math.round(expenseMonthly * 12 * 100) / 100,
      },
      investments: {
        monthly: Math.round(investmentMonthly * 100) / 100,
        annual: Math.round(investmentMonthly * 12 * 100) / 100,
      },
    };
  }, [flattenedItems]);

  const renderSectionTotal = (total: { monthly: number; annual: number }, label = "Total", emphasized = true) => (
    <tr className={`border-t ${emphasized ? "border-primary/40 bg-primary/5" : "border-border/70 bg-muted/20"} text-sm`}>
      {columns.map((col) => {
        const width = getColumnWidth(col);
        if (col === "name") {
          return <td key={col} style={{ width, maxWidth: width }} className={`px-4 py-2.5 ${emphasized ? "text-foreground" : "text-muted-foreground"}`}>{label}</td>;
        }
        if (col === "monthly") {
          return <td key={col} style={{ width, maxWidth: width }} className="px-4 py-2.5 font-display text-foreground">{total.monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}</td>;
        }
        if (col === "annual") {
          return <td key={col} style={{ width, maxWidth: width }} className="px-4 py-2.5 font-display text-foreground">{total.annual.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}</td>;
        }
        if (col === "percentage") {
          return <td key={col} style={{ width, maxWidth: width }} className="px-4 py-2.5 font-display text-foreground">{formatPercentage(total.monthly)}</td>;
        }
        return <td key={col} style={{ width, maxWidth: width }} />;
      })}
    </tr>
  );

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      <div className="order-last relative z-10 flex shrink-0 items-center justify-end gap-2 rounded-xl bg-background px-2 py-2 md:order-first">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Palette size={14} />
          <span>Category colors</span>
        </div>
        <Switch checked={colorRows} onCheckedChange={setColorRows} aria-label="Color table rows by category" />
      </div>

      {/* Notice alerts banner */}
      {activeWarnings.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
            {warningStatuses.map((status) => (
              <span
                key={status.label}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.tone === "destructive" ? "bg-destructive/15 text-destructive" : status.tone === "muted" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-500"}`}
              >
                <Clock size={10} /> {status.label} {status.count}
              </span>
            ))}
        </div>
      )}

      {/* Main Table area */}
      <div className="flex-1 bg-card border-2 border-border/80 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto scrollbar-thin">
          <table
            className="w-full text-left border-collapse min-w-[842px] [&_th:not(:last-child)]:border-r [&_th:not(:last-child)]:border-border/30 [&_td:not(:last-child)]:border-r [&_td:not(:last-child)]:border-border/30"
            style={{ tableLayout: "fixed" }}
          >
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-card/95 backdrop-blur border-b border-border/70 text-xs uppercase font-bold text-muted-foreground tracking-wider select-none">
                {columns.map((col, idx) => {
                  const width = getColumnWidth(col);
                  let title = "";
                  let alignClass = "text-left";
                  if (col === "name") title = "Budget Item";
                  else if (col === "monthly") title = `Monthly (${currency})`;
                  else if (col === "annual") title = `Annual (${currency})`;
                  else if (col === "percentage") title = "%";
                  else if (col === "dates") title = "Dates / Contract";
                  else if (col === "infos") title = "Infos / Notes";
                  else if (col === "actions") { title = ""; alignClass = "text-center"; }

                  return (
                    <th
                      key={col}
                      style={{ width }}
                      className={`py-3 px-4 uppercase font-bold text-muted-foreground tracking-wider select-none relative group/th ${alignClass}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedColIdx(idx);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedColIdx !== null && draggedColIdx !== idx) {
                          const newCols = [...columns];
                          const [moved] = newCols.splice(draggedColIdx, 1);
                          newCols.splice(idx, 0, moved);
                          setColumns(newCols);
                        }
                        setDraggedColIdx(null);
                      }}
                    >
                      <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing">
                        <span className="truncate">{title}</span>
                      </div>
                      {col !== "actions" && (
                        <div
                          onPointerDown={(e) => startResize(e, col)}
                          className="absolute right-0 top-0 bottom-0 z-10 w-3 touch-none cursor-col-resize after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border/40 hover:after:bg-primary/50"
                          title="Drag to resize column"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-sm">
              {flattenedItems.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-muted-foreground font-medium">
                    No expense or investment items found. Import a CSV to get started.
                  </td>
                </tr>
              ) : (
                flattenedItems.map((fi, index) => {
                  const { item, categoryIndex: ci, itemIndex: ii } = fi;
                  const endsSection = index === flattenedItems.length - 1 || flattenedItems[index + 1].categoryType !== fi.categoryType;
                  const startsSection = index > 0 && flattenedItems[index - 1].categoryType !== fi.categoryType;

                  // Compute notice alert status
                  let alertBadge = null;
                    if (item.cancellationDate) {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const target = new Date(item.cancellationDate);
                      target.setHours(0, 0, 0, 0);
                      const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                      if (diffDays < 0) {
                        alertBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground text-center justify-center min-w-[70px]">
                            <Clock size={10} /> Expired
                          </span>
                        );
                      } else if (diffDays <= 30) {
                        alertBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-destructive/15 text-destructive border border-destructive/20 animate-pulse text-center justify-center min-w-[70px]">
                            <AlertTriangle size={10} /> {diffDays === 0 ? "Today!" : `${diffDays}d left`}
                          </span>
                        );
                      } else if (diffDays <= 90) {
                        alertBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/15 text-center justify-center min-w-[70px]">
                            <AlertTriangle size={10} /> {diffDays}d left
                          </span>
                        );
                      } else {
                        alertBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/15 text-center justify-center min-w-[70px]">
                            <CheckCircle size={10} /> On track
                          </span>
                        );
                      }
                    }

                  return (
                    <React.Fragment key={item.id}>
                    {startsSection && (
                      <tr aria-hidden="true">
                        <td colSpan={columns.length} className="h-0.5 bg-border p-0" />
                      </tr>
                    )}
                    <tr
                      className="even:bg-muted/10 hover:bg-accent/35 group transition-colors"
                      style={colorRows ? { backgroundColor: withAlpha(fi.categoryColor, 0.12) } : undefined}
                    >
                      {columns.map((col) => {
                        const width = getColumnWidth(col);
                        if (col === "name") {
                          return (
                            <td
                              key={col}
                              style={{ width, maxWidth: width }}
                              className="py-1.5 px-4 overflow-visible"
                              title={`Category: ${fi.categoryName}`}
                            >
                              <div className="flex items-center gap-1.5 w-full">
                                <div ref={iconPickerItemId === item.id ? iconPickerRef : undefined} className="relative shrink-0">
                                  {(() => {
                                    const ItemIcon = itemIcons[item.icon || ""] || Circle;
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setIconPickerItemId(iconPickerItemId === item.id ? null : item.id)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                        title="Choose item icon"
                                        aria-label={`Choose icon for ${item.name}`}
                                      >
                                        <ItemIcon size={14} style={!colorRows ? { color: fi.categoryColor } : undefined} />
                                      </button>
                                    );
                                  })()}
                                  {iconPickerItemId === item.id && (
                                    <div className="absolute left-0 top-7 z-30 grid w-44 grid-cols-5 gap-1 rounded-xl border border-border/90 bg-card p-2 shadow-xl">
                                      {iconChoices.map(([iconKey, Icon]) => (
                                        <button
                                          key={iconKey}
                                          type="button"
                                          onClick={() => {
                                            updateItem(ci, ii, "icon", iconKey);
                                            setIconPickerItemId(null);
                                          }}
                                          className={`flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-foreground ${item.icon === iconKey ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                                          title={iconKey}
                                          aria-label={iconKey}
                                        >
                                          <Icon size={14} />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <input
                                  className="w-full bg-transparent border-none outline-none text-foreground font-medium focus:underline focus:bg-background/40 py-1 px-1.5 rounded truncate"
                                  value={item.name}
                                  onChange={(e) => updateItem(ci, ii, "name", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                />
                              </div>
                            </td>
                          );
                        }
                        if (col === "monthly") {
                          return (
                            <td key={col} style={{ width, maxWidth: width }} className="py-1.5 px-4 overflow-hidden">
                              <div className="flex items-center px-1 py-0.5">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="min-w-0 flex-1 bg-transparent border-none outline-none text-muted-foreground text-left font-display font-normal"
                                  value={
                                    (editingValue && editingValue.id === item.id && editingValue.field === "monthly")
                                      ? editingValue.val
                                      : (item.value || 0).toString()
                                  }
                                  onChange={(e) => {
                                    const rawText = e.target.value;
                                    setEditingValue({ id: item.id, field: "monthly", val: rawText });
                                    const parsed = parseFloat(rawText);
                                    if (!isNaN(parsed)) {
                                      updateItem(ci, ii, "value", parsed);
                                    } else {
                                      updateItem(ci, ii, "value", 0);
                                    }
                                  }}
                                  onFocus={(e) => {
                                    setEditingValue({ id: item.id, field: "monthly", val: (item.value || 0).toString() });
                                    e.target.select();
                                  }}
                                  onBlur={() => {
                                    setEditingValue(null);
                                  }}
                                />
                              </div>
                            </td>
                          );
                        }
                        if (col === "annual") {
                          return (
                            <td key={col} style={{ width, maxWidth: width }} className="py-1.5 px-4 overflow-hidden">
                              <div className="flex items-center px-1 py-0.5">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="w-full bg-transparent border-none outline-none text-muted-foreground text-left font-display font-normal"
                                  value={
                                    (editingValue && editingValue.id === item.id && editingValue.field === "annual")
                                      ? editingValue.val
                                      : (Math.round((item.value || 0) * 12 * 100) / 100).toString()
                                  }
                                  onChange={(e) => {
                                    const rawText = e.target.value;
                                    setEditingValue({ id: item.id, field: "annual", val: rawText });
                                    const parsed = parseFloat(rawText);
                                    if (!isNaN(parsed)) {
                                      updateItem(ci, ii, "value", Math.round((parsed / 12) * 100) / 100);
                                    } else {
                                      updateItem(ci, ii, "value", 0);
                                    }
                                  }}
                                  onFocus={(e) => {
                                    setEditingValue({
                                      id: item.id,
                                      field: "annual",
                                      val: (Math.round((item.value || 0) * 12 * 100) / 100).toString()
                                    });
                                    e.target.select();
                                  }}
                                  onBlur={() => {
                                    setEditingValue(null);
                                  }}
                                />
                              </div>
                            </td>
                          );
                        }
                        if (col === "percentage") {
                          return (
                            <td key={col} style={{ width, maxWidth: width }} className="py-1.5 px-4 overflow-hidden font-display text-muted-foreground">
                              {formatPercentage(item.value || 0)}
                            </td>
                          );
                        }

                        if (col === "dates") {
                          return (
                            <td key={col} style={{ width, maxWidth: width }} className="py-1.5 px-4 relative overflow-visible">
                              <div className="flex items-center gap-2 select-none">
                                <button
                                  onClick={(e) => {
                                    if (activeDateEditorItemId === item.id) {
                                      closeDateEditor();
                                    } else {
                                      openDateEditor(item, e.currentTarget as HTMLElement);
                                    }
                                  }}
                                  className="flex min-w-0 flex-1 flex-col text-left hover:bg-muted/40 p-1 rounded border border-transparent hover:border-border/30 transition-all truncate"
                                  title="Click to configure dates"
                                >
                                  <span className="font-display font-normal text-xs text-muted-foreground block leading-tight truncate">
                                    {item.startDate || item.endDate ? (
                                      `${formatDateForDisplay(item.startDate) || "..."} - ${formatDateForDisplay(item.endDate) || "..."}`
                                    ) : (
                                      <span className="text-muted-foreground italic font-normal">Set Dates</span>
                                    )}
                                  </span>
                                </button>
                                {item.cancellationDate && (
                                  <div className="flex shrink-0 items-center">{alertBadge}</div>
                                )}
                              </div>

                              {activeDateEditorItemId === item.id && (
                                <>
                                  <div className="fixed inset-0 z-[9998]" onClick={closeDateEditor} />
                                  <div
                                    ref={datePopoverRef}
                                    className="fixed max-h-[calc(100vh-1rem)] overflow-y-auto bg-card border border-border/90 rounded-2xl shadow-xl p-4 z-[9999] min-w-[260px] space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
                                    style={datePopoverPos ? { top: datePopoverPos.top, left: datePopoverPos.left } : {}}
                                  >
                                    <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                                      <span className="font-bold text-xs text-foreground">Configure Dates</span>
                                      <button
                                        onClick={closeDateEditor}
                                        className="text-[10px] text-muted-foreground hover:text-foreground font-semibold px-2 py-0.5 bg-muted/60 rounded"
                                      >
                                        Done
                                      </button>
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        Start Date
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="DD.MM.YYYY"
                                        className="w-full bg-background border border-border/60 text-xs p-1.5 rounded-lg outline-none text-foreground focus:border-primary/50"
                                        value={tempDates?.startDate || ""}
                                        onChange={(e) => handleTempDateChange("startDate", e.target.value, item, ci, ii)}
                                        onFocus={(e) => e.target.select()}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        End Date
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="DD.MM.YYYY"
                                        className="w-full bg-background border border-border/60 text-xs p-1.5 rounded-lg outline-none text-foreground focus:border-primary/50"
                                        value={tempDates?.endDate || ""}
                                        onChange={(e) => handleTempDateChange("endDate", e.target.value, item, ci, ii)}
                                        onFocus={(e) => e.target.select()}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        Notice Period
                                      </label>
                                      <select
                                        value={item.noticePeriod || "none"}
                                        onChange={(e) => {
                                          const period = e.target.value;
                                          updateItem(ci, ii, "noticePeriod", period);
                                          if (period !== "none" && period !== "custom" && item.endDate) {
                                            const calcDate = calculateNoticeDate(item.endDate, period);
                                            if (calcDate) {
                                              updateItem(ci, ii, "cancellationDate", calcDate);
                                              setTempDates((prev) => (prev ? { ...prev, cancellationDate: formatDateForDisplay(calcDate) } : null));
                                            }
                                          } else if (period === "none") {
                                            updateItem(ci, ii, "cancellationDate", undefined);
                                            setTempDates((prev) => (prev ? { ...prev, cancellationDate: "" } : null));
                                          }
                                        }}
                                        className="w-full bg-background border border-border/60 text-xs p-1.5 rounded-lg outline-none text-foreground cursor-pointer focus:border-primary/50"
                                      >
                                        <option value="none" className="bg-card text-foreground">None (No warning)</option>
                                        <option value="1" className="bg-card text-foreground">1 Month before</option>
                                        <option value="2" className="bg-card text-foreground">2 Months before</option>
                                        <option value="3" className="bg-card text-foreground">3 Months before</option>
                                        <option value="6" className="bg-card text-foreground">6 Months before</option>
                                        <option value="custom" className="bg-card text-foreground">Custom notice date</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        Kündigung (Notice Date)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="DD.MM.YYYY"
                                        className={`w-full bg-background border border-border/60 text-xs p-1.5 rounded-lg outline-none text-foreground font-semibold focus:border-primary/50 ${(item.noticePeriod && item.noticePeriod !== "none" && item.noticePeriod !== "custom") ? "opacity-60 cursor-not-allowed bg-muted/40" : ""}`}
                                        value={tempDates?.cancellationDate || ""}
                                        disabled={item.noticePeriod !== "custom" && item.noticePeriod !== "none" && item.noticePeriod !== undefined}
                                        onChange={(e) => handleTempDateChange("cancellationDate", e.target.value, item, ci, ii)}
                                        onFocus={(e) => e.target.select()}
                                      />
                                    </div>
                                  </div>
                                </>
                              )}
                            </td>
                          );
                        }
                        if (col === "infos") {
                          return (
                            <td key={col} style={{ width, maxWidth: width }} className="py-1.5 px-4 overflow-hidden">
                              <input
                                className="w-full bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground/30 focus:underline focus:text-foreground focus:bg-background/40 py-1 px-1.5 rounded truncate"
                                placeholder="e.g. Allianz"
                                value={item.infos || ""}
                                onChange={(e) => updateItem(ci, ii, "infos", e.target.value)}
                                onFocus={(e) => e.target.select()}
                              />
                            </td>
                          );
                        }
                        if (col === "actions") {
                          return (
                            <td key={col} style={{ width, maxWidth: width }} className="py-1.5 px-4 text-center overflow-hidden">
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete item "${item.name}"?`)) {
                                    removeItem(ci, ii);
                                    toast.success(`Removed ${item.name}`);
                                  }
                                }}
                                className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          );
                        }
                        return null;
                      })}
                    </tr>
                    {endsSection && renderSectionTotal(fi.categoryType === "investment" ? totals.investments : totals.expenses)}
                  </React.Fragment>
                );
              })
              )}
              {renderSectionTotal({ monthly: stats.remaining, annual: stats.remaining * 12 }, "Remaining", true)}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
