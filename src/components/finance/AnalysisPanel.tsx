import { ChartNoAxesCombined, ChevronRight, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnalysisForecastSettings, Stats } from "@/types/finance";

interface Props {
  stats: Stats;
  currency: string;
  showPercent?: boolean;
  forecastSettings?: AnalysisForecastSettings;
  onForecastSettingsChange?: (settings: AnalysisForecastSettings) => void;
}

const defaultForecastSettings: AnalysisForecastSettings = { annualInterestRate: "", durationYears: "10", initialCapital: "0" };

export default function AnalysisPanel({ stats, currency, showPercent = true, forecastSettings: savedForecastSettings, onForecastSettingsChange }: Props) {
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [forecastSettings, setForecastSettings] = useState(savedForecastSettings ?? defaultForecastSettings);
  useEffect(() => {
    if (savedForecastSettings) setForecastSettings(savedForecastSettings);
  }, [savedForecastSettings?.annualInterestRate, savedForecastSettings?.durationYears, savedForecastSettings?.initialCapital]);
  const updateForecastSettings = (settings: AnalysisForecastSettings) => {
    setForecastSettings(settings);
    onForecastSettingsChange?.(settings);
  };
  const multiplier = period === "annual" ? 12 : 1;
  const formatAmount = (amount: number) =>
    amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatPercent = (amount: number) => stats.income > 0 ? `${Math.round((amount / stats.income) * 100)}%` : "—";

  return (
    <div className="scrollbar-hidden mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-6 overflow-auto px-4 pt-3 md:px-0 md:pt-0">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 pb-1 sm:grid-cols-[auto_1fr_auto]">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Analysis</h2>
        <div className="order-last col-span-2 mt-2 flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 justify-self-center rounded-lg border border-border bg-card px-3 py-2 sm:order-none sm:col-span-1 sm:mt-0 sm:justify-self-start">
          <AnalysisCard label="Income" amount={stats.income * multiplier} currency={currency} valueClassName="text-emerald-500" formatAmount={formatAmount} showPercent={showPercent} percentage={formatPercent(stats.income)} />
          <AnalysisCard
            label="Remaining"
            amount={stats.remaining * multiplier}
            currency={currency}
            valueClassName={stats.remaining >= 0 ? "text-sky-500" : "text-destructive"}
            formatAmount={formatAmount}
            showPercent={showPercent}
            percentage={formatPercent(stats.remaining)}
          />
        </div>
        <div className="flex h-9 shrink-0 items-center overflow-hidden rounded-lg border border-border bg-background" role="group" aria-label="Analysis period">
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={`h-full px-3 text-sm font-semibold capitalize transition-colors ${period === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={period === option}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-12">
        <CategoryBreakdown
          title="Spending by category"
          emptyMessage="No expense data available yet."
          categories={stats.expenseCats}
          total={stats.expenses}
          budgetTotal={stats.income}
          multiplier={multiplier}
          currency={currency}
          formatAmount={formatAmount}
          icon={Receipt}
          accentClassName="text-primary"
          showPercent={showPercent}
        />
        <CategoryBreakdown
          title="Investments by category"
          emptyMessage="No investment data available yet."
          categories={stats.investmentCats}
          total={stats.investments}
          budgetTotal={stats.income}
          multiplier={multiplier}
          monthlyInvestment={stats.investments}
          monthlySavings={Math.max(0, stats.remaining)}
          forecastSettings={forecastSettings}
          onForecastSettingsChange={updateForecastSettings}
          currency={currency}
          formatAmount={formatAmount}
          icon={ChartNoAxesCombined}
          accentClassName="text-violet-500"
          showItems
          showForecast
          showPercent={showPercent}
        />
      </div>
    </div>
  );
}

interface AnalysisCardProps {
  label: string;
  amount: number;
  currency: string;
  valueClassName: string;
  formatAmount: (amount: number) => string;
  showPercent: boolean;
  percentage: string;
}

function AnalysisCard({ label, amount, currency, valueClassName, formatAmount, showPercent, percentage }: AnalysisCardProps) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {showPercent ? (
        <div className={`font-display ${valueClassName}`}>
          <span className="text-sm font-bold tabular-nums">{percentage}</span>
        </div>
      ) : (
        <div className={`flex min-w-0 items-baseline gap-1 font-display ${valueClassName}`}>
          <span className="truncate text-sm font-bold tabular-nums">{formatAmount(amount)}</span>
          <span className="shrink-0 font-sans text-xs font-medium text-muted-foreground">{currency}</span>
        </div>
      )}
    </div>
  );
}

interface CategoryBreakdownProps {
  title: string;
  emptyMessage: string;
  categories: Stats["expenseCats"];
  total: number;
  budgetTotal: number;
  multiplier: number;
  monthlyInvestment?: number;
  monthlySavings?: number;
  forecastSettings?: AnalysisForecastSettings;
  onForecastSettingsChange?: (settings: AnalysisForecastSettings) => void;
  currency: string;
  formatAmount: (amount: number) => string;
  icon: typeof Receipt;
  accentClassName: string;
  showItems?: boolean;
  showForecast?: boolean;
  showPercent: boolean;
}

function CategoryBreakdown({ title, emptyMessage, categories, total, budgetTotal, multiplier, monthlyInvestment, monthlySavings, forecastSettings, onForecastSettingsChange, currency, formatAmount, icon: Icon, accentClassName, showItems = false, showForecast = false, showPercent }: CategoryBreakdownProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set());
  const visibleCategories = [...categories].filter((category) => category.total > 0).sort((a, b) => b.total - a.total);

  return (
    <section className="flex min-w-0 flex-col">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <div className={`flex min-w-0 items-center gap-2 ${accentClassName}`}>
          <Icon size={16} className="shrink-0" />
          <h3 className="truncate text-lg font-semibold text-foreground">{title}</h3>
        </div>
        <span className="shrink-0 font-display text-base font-semibold tabular-nums text-foreground">
          {formatAmount(total * multiplier)} <span className="font-sans text-xs font-medium text-muted-foreground">{currency}</span>
        </span>
      </div>
      {visibleCategories.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="grid content-start grid-cols-1 gap-y-3">
          {visibleCategories.slice(0, 8).map((category) => {
            const percentage = budgetTotal > 0 ? (category.total / budgetTotal) * 100 : 0;
            const investmentItems = category.items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
            const expandable = showItems && investmentItems.length > 0;
            const expanded = expandedCategories.has(category.id);
            const CategoryHeader = expandable ? "button" : "div";
            return (
              <div key={category.id}>
                <CategoryHeader
                  type={expandable ? "button" : undefined}
                  aria-expanded={expandable ? expanded : undefined}
                  aria-controls={expandable ? `analysis-category-${category.id}-items` : undefined}
                  onClick={expandable ? () => setExpandedCategories((current) => {
                    const next = new Set(current);
                    if (next.has(category.id)) next.delete(category.id);
                    else next.add(category.id);
                    return next;
                  }) : undefined}
                  className={`mb-1.5 flex w-full items-center justify-between gap-3 text-left text-sm ${expandable ? "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="truncate">{category.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-display text-base font-medium tabular-nums text-foreground">{showPercent ? `${Math.round(percentage)}%` : `${formatAmount(category.total * multiplier)} ${currency}`}</span>
                    {expandable && <ChevronRight size={14} aria-hidden="true" className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />}
                  </span>
                </CategoryHeader>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: category.color }} />
                </div>
                {expandable && (
                  <div id={`analysis-category-${category.id}-items`} hidden={!expanded} className="mt-2 ml-4 space-y-2 border-l border-border/60 pl-3">
                    {investmentItems.map((item) => {
                      const itemPercentage = budgetTotal > 0 ? (item.value / budgetTotal) * 100 : 0;
                      return (
                        <div key={item.id}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate text-muted-foreground">{item.name}</span>
                            <span className="shrink-0 font-display text-sm font-medium tabular-nums text-foreground">{showPercent ? `${Math.round(itemPercentage)}%` : `${formatAmount(item.value * multiplier)} ${currency}`}</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-muted/70">
                            <div className="h-full rounded-full opacity-75" style={{ width: `${itemPercentage}%`, backgroundColor: category.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showForecast && <InvestmentForecast monthlyInvestment={monthlyInvestment ?? total} monthlySavings={monthlySavings ?? 0} settings={forecastSettings ?? defaultForecastSettings} onSettingsChange={onForecastSettingsChange ?? (() => {})} currency={currency} formatAmount={formatAmount} />}
    </section>
  );
}

interface InvestmentForecastProps {
  monthlyInvestment: number;
  monthlySavings: number;
  settings: AnalysisForecastSettings;
  onSettingsChange: (settings: AnalysisForecastSettings) => void;
  currency: string;
  formatAmount: (amount: number) => string;
}

function InvestmentForecast({ monthlyInvestment, monthlySavings, settings, onSettingsChange, currency, formatAmount }: InvestmentForecastProps) {
  const { annualInterestRate: rateInput, durationYears: yearsInput } = settings;
  const initialCapitalInput = settings.initialCapital ?? "0";
  const annualRate = Number(rateInput) / 100;
  const years = Number(yearsInput);
  const initialCapital = Number(initialCapitalInput || "0");
  const hasValidInputs = rateInput.trim() !== "" && Number.isFinite(annualRate) && annualRate >= 0 && annualRate <= 1
    && Number.isFinite(initialCapital) && initialCapital >= 0
    && Number.isInteger(years) && years >= 1 && years <= 50;

  const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
  const months = hasValidInputs ? years * 12 : 0;
  const investmentContributions = roundMoney(monthlyInvestment * months);
  const savedRemaining = roundMoney(monthlySavings * months);
  let investmentBalance = initialCapital;

  if (hasValidInputs) {
    for (let month = 1; month <= months; month += 1) {
      investmentBalance *= 1 + annualRate / 12;
      investmentBalance += monthlyInvestment;
    }
    investmentBalance = roundMoney(investmentBalance);
  }

  const totalInterest = roundMoney(investmentBalance - initialCapital - investmentContributions);
  const projectedBalance = roundMoney(initialCapital + investmentContributions + totalInterest + savedRemaining);

  return (
    <div className="mt-6">
      <h4 className="mb-3 text-base font-semibold text-foreground">Investment forecast</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 space-y-1 text-sm text-muted-foreground sm:col-span-1">
          <span>Starting capital</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={initialCapitalInput}
            onChange={(event) => onSettingsChange({ ...settings, initialCapital: event.target.value })}
            className="h-10 w-full rounded-md border border-border bg-background px-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Starting investment capital"
          />
        </label>
        <label className="space-y-1 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">Annual interest rate (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            inputMode="decimal"
            value={rateInput}
            onChange={(event) => onSettingsChange({ ...settings, annualInterestRate: event.target.value })}
            placeholder="e.g. 7"
            className="h-10 w-full rounded-md border border-border bg-background px-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Annual interest rate in percent"
          />
        </label>
        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Duration (years)</span>
          <input
            type="number"
            min="1"
            max="50"
            step="1"
            inputMode="numeric"
            value={yearsInput}
            onChange={(event) => onSettingsChange({ ...settings, durationYears: event.target.value })}
            className="h-10 w-full rounded-md border border-border bg-background px-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Investment duration in years"
          />
        </label>
      </div>
      {hasValidInputs ? (
        <div className="mt-4">
          <h5 className="mb-2 text-sm font-semibold text-foreground">After {years} years</h5>
          <ForecastBreakdownRow label="Starting capital" value={initialCapital} currency={currency} formatAmount={formatAmount} />
          <ForecastBreakdownRow label="Contributions (principal)" operator="+" value={investmentContributions} currency={currency} formatAmount={formatAmount} />
          <ForecastBreakdownRow label="Investment interest" operator="+" value={totalInterest} currency={currency} formatAmount={formatAmount} />
          <ForecastBreakdownRow label="Remaining saved" operator="+" value={savedRemaining} currency={currency} formatAmount={formatAmount} />
          <ForecastBreakdownRow label="Total accumulated" operator="=" value={projectedBalance} currency={currency} formatAmount={formatAmount} total />
        </div>
      ) : (
          <p className="mt-3 text-sm text-muted-foreground">Enter a rate from 0 to 100%, starting capital of 0 or more, and a duration from 1 to 50 years to see your projection.</p>
      )}
    </div>
  );
}

interface ForecastBreakdownRowProps {
  label: string;
  value: number;
  currency: string;
  formatAmount: (amount: number) => string;
  operator?: "+" | "=";
  total?: boolean;
}

function ForecastBreakdownRow({ label, value, currency, formatAmount, operator, total = false }: ForecastBreakdownRowProps) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 ${total ? "mt-3 pt-2" : ""}`}>
      <div className="flex items-baseline gap-2 text-sm leading-snug">
        <span className={`w-3 shrink-0 text-center ${total ? "font-semibold text-primary" : "text-muted-foreground"}`}>{operator ?? ""}</span>
        <span className={`whitespace-nowrap ${total ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
      </div>
      <span className={`ml-auto min-w-0 max-w-full break-words text-right font-display tabular-nums leading-tight ${total ? "text-base font-bold text-foreground sm:text-lg" : "text-base font-medium text-foreground"}`}>
        {formatAmount(value)} <span className="font-sans text-sm font-medium text-muted-foreground">{currency}</span>
      </span>
    </div>
  );
}
