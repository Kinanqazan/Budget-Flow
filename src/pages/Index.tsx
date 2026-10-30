import { useEffect, useState } from "react";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useAuth } from "@/hooks/useAuth";
import FinanceSidebar from "@/components/finance/FinanceSidebar";
import SwipeableSidebar from "@/components/finance/SwipeableSidebar";
import SankeyChart from "@/components/finance/SankeyChart";
import MobileAllocation from "@/components/finance/MobileAllocation";
import AuthBar from "@/components/finance/AuthBar";
import AuthPage from "@/components/finance/AuthPage";
import { ChevronRight, Split, PieChart, Table, BarChart3 } from "lucide-react";
import DonutChart from "@/components/finance/DonutChart";
import FinanceTable from "@/components/finance/FinanceTable";
import AnalysisPanel from "@/components/finance/AnalysisPanel";
import SettingsPanel from "@/components/finance/SettingsPanel";
import { useIsMobile } from "@/hooks/use-mobile";

type ChartType = "sankey" | "donut" | "table" | "analyses" | "settings";
const chartTypes: ChartType[] = ["sankey", "donut", "table", "analyses", "settings"];
const currentViewKey = "budgetflow-current-view";

const Index = () => {
  const { user, loading: authLoading, username, authEnabled, registrationAvailable, signIn, signUp, signOut, deleteAccount } = useAuth();

  const {
    data, stats, darkMode, setDarkMode, currency, setCurrency, currencies, loading, setAnalysisForecast,
    updateIncome, addIncome, removeIncome, moveIncome,
    updateCategory, addCategory, removeCategory, moveCategory,
    updateItem, addItem, removeItem, moveItem,
    updateRemainingColor,
    updateIncomeColor,
    importFromCsv,
    exportToCsv,
    save, saveToJson, importFromJson, syncConflict, loadSavedBudget,
  } = useFinanceData(user?.id, !!user);

  const [showPercent, setShowPercent] = useState(true);
  const [chartType, setChartType] = useState<ChartType>(() => {
    try {
      const saved = sessionStorage.getItem(currentViewKey);
      return chartTypes.find((type) => type === saved) ?? "sankey";
    } catch {
      return "sankey";
    }
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    try {
      sessionStorage.setItem(currentViewKey, chartType);
    } catch {
      // The app remains usable if browser storage is unavailable.
    }
  }, [chartType]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  if (authLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">
        <div role="status" className="flex items-center gap-3 text-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
          Checking sign-in status…
        </div>
      </main>
    );
  }

  if (authEnabled && !user) {
    return <AuthPage registrationAvailable={registrationAvailable} signIn={signIn} signUp={signUp} />;
  }

  return (
    <SwipeableSidebar sidebar={(close) => (
        <FinanceSidebar
          data={data}
          updateIncome={updateIncome}
          addIncome={addIncome}
          removeIncome={removeIncome}
          moveIncome={moveIncome}
          updateCategory={updateCategory}
          addCategory={addCategory}
          removeCategory={removeCategory}
          moveCategory={moveCategory}
          updateItem={updateItem}
          addItem={addItem}
          removeItem={removeItem}
          moveItem={moveItem}
          updateIncomeColor={updateIncomeColor}
          onClose={close}
        />
    )}>
      {({ open, isOpen: sidebarOpen }) => (
      <main className={`flex-1 overflow-auto scrollbar-hidden ${chartType === "table" ? "p-0" : "p-4"} flex flex-col min-w-0`}>
        {syncConflict && (
          <div role="alert" className={`mb-3 rounded-lg border border-border bg-card p-3 text-sm ${chartType === "table" ? "mx-4 mt-4" : ""}`}>
            <p>Changes could not be saved or confirmed. Your unsaved edits are kept here. Loading the saved budget replaces them.</p>
            <div className="mt-2 flex gap-3">
              <button className="underline" onClick={saveToJson}>Export my edits</button>
              <button className="underline" onClick={loadSavedBudget}>Load saved budget</button>
            </div>
          </div>
        )}
        <div className={`flex items-center justify-between gap-2.5 select-none flex-nowrap ${chartType === "table" ? "mx-4 mt-4 mb-2 w-auto" : "mb-4 w-full"}`}>
          {/* Left: Sidebar Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!sidebarOpen && (
              <button
                onClick={open}
                className="flex h-8 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                title="Open sidebar"
                aria-label="Open sidebar"
                aria-controls="finance-sidebar"
                aria-expanded={sidebarOpen}
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {/* Right: Consolidated Controls (Currency + Views + Account) */}
          <div className="flex items-center gap-2 shrink-0 ml-auto flex-nowrap flex-1 md:flex-initial justify-end">
            {/* Chart Switcher */}
            <div className="flex items-center bg-background md:bg-card border border-border rounded-xl overflow-hidden h-11 flex-[2] md:flex-initial">
              <button
                onClick={() => setChartType("sankey")}
                className={`flex-1 md:px-3.5 h-full flex items-center justify-center transition-colors ${chartType === "sankey" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Flow chart"
              >
                <Split size={16} />
              </button>
              <button
                onClick={() => setChartType("donut")}
                className={`flex-1 md:px-3.5 h-full flex items-center justify-center transition-colors ${chartType === "donut" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Donut chart"
              >
                <PieChart size={16} />
              </button>
              <button
                onClick={() => setChartType("table")}
                className={`flex-1 md:px-3.5 h-full flex items-center justify-center transition-colors ${chartType === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Table View"
              >
                <Table size={16} />
              </button>
              <button
                onClick={() => setChartType("analyses")}
                className={`flex-1 md:px-3.5 h-full flex items-center justify-center transition-colors ${chartType === "analyses" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Analysis"
              >
                <BarChart3 size={16} />
              </button>
            </div>

            {chartType !== "settings" && (
              <div className="flex h-11 shrink-0 items-center overflow-hidden rounded-xl border border-border bg-background md:bg-card" role="group" aria-label="Value display">
                <button
                  onClick={() => setShowPercent(true)}
                  className={`h-full px-3 text-xs font-semibold transition-colors ${showPercent ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  aria-label="Show percentages"
                  aria-pressed={showPercent}
                >%</button>
                <button
                  onClick={() => setShowPercent(false)}
                  className={`h-full px-3 text-xs font-semibold transition-colors ${!showPercent ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  aria-label={`Show values in ${currency}`}
                  aria-pressed={!showPercent}
                >{currency}</button>
              </div>
            )}

            {/* Profile opens settings */}
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background md:bg-card">
              <AuthBar
                user={user}
                username={username}
                loading={authLoading}
                authEnabled={authEnabled}
                registrationAvailable={registrationAvailable}
                onOpenSettings={() => setChartType("settings")}
                signIn={signIn}
                signUp={signUp}
              />
            </div>
          </div>
        </div>

        <div className={`relative flex-1 ${chartType === "table" ? "p-0" : chartType === "analyses" ? "p-0 md:p-4" : "p-4"} flex flex-col min-h-0 overflow-y-auto scrollbar-hidden`}>
          {chartType === "sankey" ? (
            isMobile ? (
              <MobileAllocation data={data} stats={stats} showPercent={showPercent} currency={currency} />
            ) : (
              <SankeyChart data={data} stats={stats} showPercent={showPercent} currency={currency} />
            )
          ) : chartType === "donut" ? (
            <DonutChart data={data} stats={stats} currency={currency} showPercent={showPercent} />
          ) : chartType === "table" ? (
            <FinanceTable
              data={data}
              stats={stats}
              updateItem={updateItem}
              removeItem={removeItem}
              currency={currency}
              showPercent={showPercent}
            />
          ) : chartType === "analyses" ? (
            <AnalysisPanel
              stats={stats}
              currency={currency}
              showPercent={showPercent}
              forecastSettings={data.analysisForecast}
              onForecastSettingsChange={setAnalysisForecast}
            />
          ) : (
            <SettingsPanel
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              currency={currency}
              setCurrency={setCurrency}
              currencies={currencies}
              remainingColor={data.remainingColor}
              updateRemainingColor={updateRemainingColor}
              importFromCsv={importFromCsv}
              exportToCsv={exportToCsv}
              save={save}
              saveToJson={saveToJson}
              importFromJson={importFromJson}
              loading={loading}
              username={username}
              authEnabled={authEnabled}
              user={user}
              signOut={signOut}
              deleteAccount={deleteAccount}
            />
          )}
        </div>
      </main>
      )}
    </SwipeableSidebar>
  );
};

export default Index;
