import { ChartNoAxesCombined, ChevronRight, Receipt } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { AnalysisForecastSettings, Stats } from "@/types/finance";

interface Props {
  stats: Stats;
  currency: string;
  showPercent?: boolean;
  forecastSettings?: AnalysisForecastSettings;
  onForecastSettingsChange?: (settings: AnalysisForecastSettings) => void;
}

const defaultForecastSettings: AnalysisForecastSettings = { annualInterestRate: "", durationYears: "10", initialCapital: "0", compoundingInterval: "monthly" };

export default function AnalysisPanel({ stats, currency, showPercent = true, forecastSettings: savedForecastSettings, onForecastSettingsChange }: Props) {
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [forecastSettings, setForecastSettings] = useState(savedForecastSettings ?? defaultForecastSettings);
  const savedAnnualInterestRate = savedForecastSettings?.annualInterestRate;
  const savedDurationYears = savedForecastSettings?.durationYears;
  const savedInitialCapital = savedForecastSettings?.initialCapital;
  const savedCompoundingInterval = savedForecastSettings?.compoundingInterval;
  useEffect(() => {
    if (savedAnnualInterestRate !== undefined && savedDurationYears !== undefined && savedInitialCapital !== undefined) {
      setForecastSettings({ annualInterestRate: savedAnnualInterestRate, durationYears: savedDurationYears, initialCapital: savedInitialCapital, compoundingInterval: savedCompoundingInterval });
    }
  }, [savedAnnualInterestRate, savedDurationYears, savedInitialCapital, savedCompoundingInterval]);
  const updateForecastSettings = (settings: AnalysisForecastSettings) => {
    setForecastSettings(settings);
    onForecastSettingsChange?.(settings);
  };
  const multiplier = period === "annual" ? 12 : 1;
  const formatAmount = (amount: number) =>
    amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatPercent = (amount: number) => stats.income > 0 ? `${Math.round((amount / stats.income) * 100)}%` : "—";

  return (
    <div className="scrollbar-hidden mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-4 overflow-auto px-2 pb-8 pt-3 sm:gap-6 sm:px-4 md:px-0 md:pt-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your money at a glance</p><h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Analysis</h2></div>
        <div className="flex h-10 shrink-0 items-center rounded-xl border border-border bg-card p-1" role="group" aria-label="Analysis period">
          {(["monthly", "annual"] as const).map((option) => (
            <button key={option} type="button" onClick={() => setPeriod(option)} className={`h-full rounded-lg px-3 text-sm font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === option ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} aria-pressed={period === option}>{option}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-border/70 bg-card p-3 sm:p-5">
        <CategoryBreakdown
          title="Expenses"
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
        </div>
        <div className="grid min-w-0 gap-5 rounded-xl border border-border/70 bg-card p-3 sm:p-5">
        <CategoryBreakdown
          title="Investments"
          emptyMessage="No investment data available yet."
          categories={stats.investmentCats}
          total={stats.investments}
          budgetTotal={stats.income}
          multiplier={multiplier}
          currency={currency}
          formatAmount={formatAmount}
          icon={ChartNoAxesCombined}
          accentClassName="text-violet-500"
          showItems
          showPercent={showPercent}
        />
        <section aria-label="Remaining budget" className="flex min-w-0 items-center justify-between gap-4 border-t border-border/70 pt-4">
          <div className="min-w-0"><h3 className="text-sm font-semibold text-foreground">Remaining budget</h3><p className="mt-1 text-xs text-muted-foreground">After spending and investments</p></div>
          <span className={`break-all text-right font-display text-lg font-semibold tabular-nums ${stats.remaining < 0 ? "text-destructive" : "text-teal-600 dark:text-teal-400"}`}>
            {showPercent ? formatPercent(stats.remaining) : `${formatAmount(stats.remaining * multiplier)} ${currency}`}
          </span>
        </section>
        </div>
      </div>
      <InvestmentForecast monthlyInvestment={stats.investments} monthlySavings={Math.max(0, stats.remaining)} settings={forecastSettings} onSettingsChange={updateForecastSettings} currency={currency} formatAmount={formatAmount} />
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
  currency: string;
  formatAmount: (amount: number) => string;
  icon: typeof Receipt;
  accentClassName: string;
  showItems?: boolean;
  showPercent: boolean;
}

function CategoryBreakdown({ title, emptyMessage, categories, total, budgetTotal, multiplier, currency, formatAmount, icon: Icon, accentClassName, showItems = false, showPercent }: CategoryBreakdownProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set());
  const visibleCategories = [...categories].filter((category) => category.total > 0).sort((a, b) => b.total - a.total);

  return (
    <section className="flex min-w-0 flex-col">
      <div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className={`flex min-w-0 items-center gap-3 ${accentClassName}`}>
          <Icon size={18} className="shrink-0" />
          <h3 className="text-base font-semibold text-foreground sm:text-lg">{title}</h3>
        </div>
        <span className="shrink-0 font-display text-base font-semibold tabular-nums text-foreground">
          {showPercent ? `${budgetTotal > 0 ? Math.round(total / budgetTotal * 100) : 0}%` : <>{formatAmount(total * multiplier)} <span className="font-sans text-xs font-medium text-muted-foreground">{currency}</span></>}
        </span>
      </div>
      {visibleCategories.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="grid content-start grid-cols-1 gap-y-5">
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
  const compoundingInterval = settings.compoundingInterval ?? "monthly";
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
  const yearlyProjection: { year: number; principal: number; interest: number; balance: number }[] = [];

  if (hasValidInputs) {
    for (let year = 1; year <= years; year += 1) {
      if (compoundingInterval === "monthly") {
        for (let month = 0; month < 12; month += 1) investmentBalance = (investmentBalance + monthlyInvestment) * (1 + annualRate / 12);
      } else {
        // Deposits occur at the start of each month and accrue simple interest until year-end.
        investmentBalance = investmentBalance * (1 + annualRate) + monthlyInvestment * (12 + 6.5 * annualRate);
      }
      const principal = initialCapital + monthlyInvestment * year * 12;
      yearlyProjection.push({ year, principal, interest: investmentBalance - principal, balance: investmentBalance });
    }
    investmentBalance = roundMoney(investmentBalance);
  }

  const totalInterest = roundMoney(investmentBalance - initialCapital - investmentContributions);
  const projectedBalance = investmentBalance;

  return (
    <section className="min-w-0 rounded-xl border border-border/70 bg-card p-3 sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-border/70 pb-4">
        <h3 className="text-lg font-semibold text-foreground sm:text-xl">Investment forecast</h3>
        <div className="flex w-full items-start justify-between gap-3 sm:w-auto sm:justify-start sm:gap-5">
          <div className="min-w-0 text-xs text-muted-foreground"><span className="block font-medium leading-4">Monthly investment</span><span className="mt-1 block break-words font-display text-sm font-semibold tabular-nums text-foreground">{formatAmount(monthlyInvestment)} {currency}</span></div>
          <fieldset className="min-w-0 shrink-0"><legend className="mb-1 text-xs font-medium leading-4 text-muted-foreground">Interest compounding</legend><div className="inline-flex rounded-lg border border-border bg-background p-0.5">{(["monthly", "annual"] as const).map((interval) => <button key={interval} type="button" aria-pressed={compoundingInterval === interval} onClick={() => onSettingsChange({ ...settings, compoundingInterval: interval })} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compoundingInterval === interval ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{interval === "monthly" ? "Monthly" : "Yearly"}</button>)}</div></fieldset>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <label className="space-y-1.5 text-sm font-medium text-muted-foreground">
          <span>Starting capital</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={initialCapitalInput}
            onChange={(event) => onSettingsChange({ ...settings, initialCapital: event.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Starting investment capital"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-muted-foreground">
          <span>Annual interest rate (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            inputMode="decimal"
            value={rateInput}
            onChange={(event) => onSettingsChange({ ...settings, annualInterestRate: event.target.value })}
            placeholder="e.g. 7"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Annual interest rate in percent"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-muted-foreground">
          <span>Duration (years)</span>
          <input
            type="number"
            min="1"
            max="50"
            step="1"
            inputMode="numeric"
            value={yearsInput}
            onChange={(event) => onSettingsChange({ ...settings, durationYears: event.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Investment duration in years"
          />
        </label>
      </div>
      {hasValidInputs ? (
        <div className="mt-6">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="min-w-0">
          <h5 className="mb-3 text-sm font-semibold text-foreground">After {years} years</h5>
          <ForecastBreakdownRow label="Starting capital" value={initialCapital} currency={currency} formatAmount={formatAmount} />
          <ForecastBreakdownRow label="All monthly deposits" operator="+" value={investmentContributions} currency={currency} formatAmount={formatAmount} />
          <ForecastBreakdownRow label="Total deposited" operator="=" value={roundMoney(initialCapital + investmentContributions)} currency={currency} formatAmount={formatAmount} total accent="violet" />
          <ForecastBreakdownRow label="Investment interest" operator="+" value={totalInterest} currency={currency} formatAmount={formatAmount} accent="teal" />
          <ForecastBreakdownRow label="Investment total" operator="=" value={projectedBalance} currency={currency} formatAmount={formatAmount} total accent="blue" />
          <ForecastBreakdownRow label="Remaining saved separately" value={savedRemaining} currency={currency} formatAmount={formatAmount} alignWithOperator />
          </div>
          <ForecastChart data={yearlyProjection} currency={currency} formatAmount={formatAmount} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Contributions are invested at the start of each month. {compoundingInterval === "monthly" ? `The annual rate is divided by 12 and compounded monthly (effective annual rate: ${((Math.pow(1 + annualRate / 12, 12) - 1) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%).` : "Interest is credited yearly; monthly deposits accrue interest for the part of the year they are invested."} This is a fixed-rate estimate; taxes, fees and inflation are excluded.</p>
        </div>
      ) : (
          <p className="mt-5 rounded-xl bg-muted/40 px-4 py-5 text-sm leading-relaxed text-muted-foreground">Enter a rate from 0 to 100%, starting capital of 0 or more, and a duration from 1 to 50 years to see your projection.</p>
      )}
    </section>
  );
}

function ForecastChart({ data, currency, formatAmount }: { data: { year: number; principal: number; interest: number; balance: number }[]; currency: string; formatAmount: (value: number) => string }) {
  const chartId = useId();
  const max = Math.max(1, ...data.map((point) => point.balance));
  const width = Math.max(340, data.length * 32);
  const plotHeight = 180;
  const chartWidth = width - 48;
  const step = chartWidth / data.length;
  const labelInterval = Math.max(1, Math.ceil(data.length / 10));
  return (
    <div className="min-w-0 border-t border-border/70 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
      <h5 className="text-sm font-semibold text-foreground">Investment growth</h5>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-violet-500" />Total deposited</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-teal-500" />Investment interest</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 -8 ${width} 228`} style={{ minWidth: data.length > 10 ? width : 0 }} className="h-auto w-full" role="img" aria-label="Yearly investment growth chart. Detailed values follow in the table.">
          <defs><linearGradient id={`${chartId}-principal`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient><linearGradient id={`${chartId}-interest`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5eead4" /><stop offset="100%" stopColor="#0d9488" /></linearGradient></defs>
          {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1="0" x2={chartWidth} y1={plotHeight * (1 - fraction)} y2={plotHeight * (1 - fraction)} stroke="currentColor" strokeDasharray={fraction ? "3 4" : undefined} className="text-border" /><text x={chartWidth + 4} y={plotHeight * (1 - fraction) + 4} className="fill-muted-foreground" fontSize="10">{Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(max * fraction)}</text></g>)}
          {data.map((point, index) => {
            const principalHeight = point.principal / max * plotHeight;
            const interestHeight = point.interest / max * plotHeight;
            const x = index * step + step * 0.2;
            const barWidth = step * 0.56;
            const clipId = `${chartId}-bar-${point.year}`;
            return <g key={point.year}><title>Year {point.year}: {formatAmount(point.balance)} {currency}</title><clipPath id={clipId}><rect x={x} y={plotHeight - principalHeight - interestHeight} width={barWidth} height={principalHeight + interestHeight} rx={Math.min(4, barWidth / 2)} /></clipPath><g clipPath={`url(#${clipId})`}><rect x={x} y={plotHeight - principalHeight} width={barWidth} height={principalHeight} fill={`url(#${chartId}-principal)`} /><rect x={x} y={plotHeight - principalHeight - interestHeight} width={barWidth} height={interestHeight} fill={`url(#${chartId}-interest)`} /></g>{(point.year === 1 || point.year === data.length || point.year % labelInterval === 0) && <text x={x + barWidth / 2} y="198" textAnchor="middle" className="fill-muted-foreground" fontSize="10">{point.year}</text>}</g>;
          })}
          <text x="0" y="216" className="fill-muted-foreground" fontSize="10">Years</text>
        </svg>
      </div>
      <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer rounded font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Yearly values</summary><div className="overflow-x-auto"><table className="mt-3 w-full min-w-[360px] text-right tabular-nums"><thead><tr className="border-b border-border"><th className="py-2 text-left">Year</th><th>Total deposited</th><th>Interest</th><th>Total ({currency})</th></tr></thead><tbody>{data.map((point) => <tr key={point.year} className="border-b border-border/50"><th className="py-2 text-left font-normal">{point.year}</th><td>{formatAmount(point.principal)}</td><td>{formatAmount(point.interest)}</td><td>{formatAmount(point.balance)}</td></tr>)}</tbody></table></div></details>
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
  alignWithOperator?: boolean;
  accent?: "violet" | "teal" | "blue";
}

function ForecastBreakdownRow({ label, value, currency, formatAmount, operator, total = false, alignWithOperator = false, accent }: ForecastBreakdownRowProps) {
  const accentClass = accent === "violet" ? "text-violet-700 dark:text-violet-300" : accent === "teal" ? "text-teal-700 dark:text-teal-300" : accent === "blue" ? "text-blue-700 dark:text-blue-300" : "";
  return (
    <div className={`flex items-baseline gap-x-2 py-2 ${total ? "my-2 border-y border-border py-3" : ""}`}>
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm leading-snug">
        {!alignWithOperator && <span className={`w-3 shrink-0 text-center ${total ? "font-semibold text-primary" : "text-muted-foreground"}`}>{operator ?? ""}</span>}
        <span className={accent ? `${total ? "font-semibold" : "font-medium"} ${accentClass}` : total ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
      </div>
      <span className={`min-w-0 max-w-[55%] break-words text-right font-display tabular-nums leading-tight ${total ? "text-sm font-bold sm:text-lg" : "text-sm font-medium sm:text-base"} ${accentClass || "text-foreground"}`}>
        {formatAmount(value)} <span className="font-sans text-sm font-medium text-muted-foreground">{currency}</span>
      </span>
    </div>
  );
}
