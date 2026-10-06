import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { FinanceData, Stats } from "@/types/finance";

interface Props {
  data: FinanceData;
  stats: Stats;
  showPercent?: boolean;
  currency?: string;
}

const formatMoney = (value: number, currency: string) =>
  `${Math.round(value).toLocaleString()} ${currency}`;

export default function MobileAllocation({
  data,
  stats,
  showPercent = false,
  currency = "€",
}: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const allocated = stats.expenses + stats.investments;
  const overBudget = stats.remaining < -0.01;
  const barTotal = Math.max(stats.income, allocated);
  const percentOfIncome = (value: number) =>
    stats.income > 0 ? `${Math.round((value / stats.income) * 100)}%` : "—";
  const formatValue = (value: number) =>
    showPercent && stats.income > 0 ? percentOfIncome(value) : formatMoney(value, currency);

  const summary = [
    { label: "Income", value: stats.income, tone: "text-foreground" },
    { label: "Allocated", value: allocated, tone: "text-primary" },
    {
      label: overBudget ? "Over budget" : "Remaining",
      value: Math.abs(stats.remaining),
      tone: overBudget ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
    },
  ];

  const barSegments = [
    { label: "Expenses", value: stats.expenses, color: "hsl(var(--primary))" },
    { label: "Investments", value: stats.investments, color: "#8b5cf6" },
    {
      label: "Remaining",
      value: Math.max(0, stats.remaining),
      color: data.remainingColor || "#4DB6AC",
    },
  ].filter((segment) => segment.value > 0);

  const categories = [...stats.cats]
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total);
  const categoryBarTotal = Math.max(stats.income, allocated);
  const categoryBarBasis = stats.income >= allocated ? "income" : "total allocation";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-5">
      <header className="flex h-10 items-center">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Money flow</h1>
      </header>

      <section aria-label="Budget summary" className="grid grid-cols-3 gap-2">
        {summary.map((item) => (
          <div key={item.label} className="min-w-0 rounded-xl border border-border/70 bg-card px-2.5 py-3 shadow-sm">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className={`mt-1 break-words font-display text-[13px] font-bold leading-tight tabular-nums ${item.tone}`}>
              {formatValue(item.value)}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">Income split</h2>
          {overBudget && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive">
              <AlertTriangle size={12} aria-hidden="true" />
              Over budget
            </span>
          )}
        </div>

        <div
          role="img"
          aria-label={barSegments.map((segment) => `${segment.label}: ${formatValue(segment.value)}`).join(", ") || "No allocations yet"}
          className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
        >
          {barTotal > 0 && barSegments.map((segment) => (
            <span
              key={segment.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(segment.value / barTotal) * 100}%`, backgroundColor: segment.color }}
            />
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            ...barSegments,
            ...(overBudget
              ? [{ label: "Over budget", value: Math.abs(stats.remaining), color: "hsl(var(--destructive))" }]
              : []),
          ].map((segment) => (
            <div key={segment.label} className="flex min-w-0 items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="shrink-0 font-display font-semibold tabular-nums text-foreground">
                {formatValue(segment.value)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">By category</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Bars show each category’s share of {categoryBarBasis}.
            </p>
          </div>
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Add an expense or investment category to see the breakdown.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            {categories.map((category, index) => {
              const expanded = expandedCategory === category.id;
              const items = category.items
                .filter((item) => item.value > 0)
                .sort((a, b) => b.value - a.value);
              const barWidth = categoryBarTotal > 0
                ? Math.min(100, (category.total / categoryBarTotal) * 100)
                : 0;
              const detailsId = `mobile-category-${category.id}`;

              return (
                <div key={category.id} className={index > 0 ? "border-t border-border/60" : ""}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={detailsId}
                    onClick={() => setExpandedCategory(expanded ? null : category.id)}
                    className="flex min-h-14 w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-foreground">{category.name}</span>
                        {category.type === "investment" && (
                          <span className="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                            Invest
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full transition-[width]"
                          style={{ width: `${barWidth}%`, backgroundColor: category.color }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-xs font-semibold tabular-nums text-foreground">
                        {formatValue(category.total)}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {categoryBarTotal > 0 ? `${Math.round((category.total / categoryBarTotal) * 100)}% of ${categoryBarBasis}` : "—"}
                      </span>
                    </span>
                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  {expanded && (
                    <div id={detailsId} className="pb-3 pl-9 pr-4">
                      {items.length > 0 ? (
                        <ul className="space-y-2 border-l border-border/70 pl-3">
                          {items.map((item) => (
                            <li key={item.id} className="flex items-start justify-between gap-3 text-xs">
                              <span className="min-w-0 break-words text-muted-foreground">{item.name}</span>
                              <span className="shrink-0 font-display font-medium tabular-nums text-foreground">
                                {formatValue(item.value)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="border-l border-border/70 pl-3 text-xs text-muted-foreground">No items in this category yet.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
