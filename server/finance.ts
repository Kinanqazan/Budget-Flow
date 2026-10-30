export interface IncomeItem {
  id: string;
  name: string;
  value: number;
}

export interface ExpenseItem {
  id: string;
  name: string;
  value: number;
  icon?: string;
  startDate?: string;
  endDate?: string;
  infos?: string;
  cancellationDate?: string;
  billingPeriod?: 'Monthly' | 'Annual';
  noticePeriod?: string;
}

export type CategoryType = "expense" | "investment";

export interface Category {
  id: string;
  name: string;
  color: string;
  /** Categories saved before investment support are treated as expenses. */
  type?: CategoryType;
  items: ExpenseItem[];
}

export interface FinanceData {
  income: IncomeItem[];
  categories: Category[];
  remainingColor?: string;
  incomeColor?: string;
  analysisForecast?: AnalysisForecastSettings;
}

export interface AnalysisForecastSettings {
  annualInterestRate: string;
  durationYears: string;
  initialCapital?: string;
}

export interface Stats {
  income: number;
  expenses: number;
  investments: number;
  remaining: number;
  cats: (Category & { total: number })[];
  expenseCats: (Category & { total: number })[];
  investmentCats: (Category & { total: number })[];
}

export function calculateStats(data: FinanceData): Stats {
  const income = Math.round(data.income.reduce((sum, item) => sum + (item.value || 0), 0));
  const cats = data.categories.map(category => ({ ...category, total: Math.round(category.items.reduce((sum, item) => sum + (item.value || 0), 0)) }));
  const expenseCats = cats.filter(category => category.type !== "investment");
  const investmentCats = cats.filter(category => category.type === "investment");
  const expenses = expenseCats.reduce((sum, category) => sum + category.total, 0);
  const investments = investmentCats.reduce((sum, category) => sum + category.total, 0);
  return { income, cats, expenseCats, investmentCats, expenses, investments, remaining: income - expenses - investments };
}
