import { useEffect, useState } from "react";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useAuth } from "@/hooks/useAuth";
import FinanceSidebar from "@/components/finance/FinanceSidebar";
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

const Index = () => {
  const { user, loading: authLoading, username, authEnabled, registrationAvailable, signIn, signUp, signOut, deleteAccount } = useAuth();

  const {
    data, stats, darkMode, setDarkMode, currency, setCurrency, currencies, loading,
    updateIncome, addIncome, removeIncome, moveIncome,
    updateCategory, addCategory, removeCategory, moveCategory,
    updateItem, addItem, removeItem, moveItem,
    updateRemainingColor,
    updateIncomeColor,
    importFromCsv,
    exportToCsv,
    save, saveToJson, importFromJson,
  } = useFinanceData(user?.id, !!user);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPercent, setShowPercent] = useState(false);
  const [chartType, setChartType] = useState<"sankey" | "donut" | "table" | "analyses" | "settings">("sankey");
  const isMobile = useIsMobile();

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
    <div className="flex h-screen overflow-hidden relative">
      {/* Sidebar Overlay backdrop on mobile */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      <div
        className={`transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? "w-[300px] min-w-[300px] md:relative fixed inset-y-0 left-0 z-50 shadow-2xl md:shadow-none" 
            : "w-0 min-w-0 md:relative fixed inset-y-0 left-0"
        } overflow-hidden`}
      >
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
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <main className={`flex-1 overflow-auto p-4 flex flex-col min-w-0 ${chartType === "analyses" ? "scrollbar-hidden" : ""}`}>
        <div className="flex items-center justify-between gap-2.5 mb-4 select-none w-full flex-nowrap">
          {/* Left: Sidebar Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-8 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                title="Open sidebar"
                aria-label="Open sidebar"
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
                title="Analyses"
              >
                <BarChart3 size={16} />
              </button>
            </div>

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

        <div className={`relative flex-1 ${chartType === "table" ? "p-1" : "p-4"} flex flex-col min-h-0 overflow-y-auto`}>
          {(chartType === "sankey" || chartType === "donut") && (
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <div className="flex items-center bg-background/95 border border-border rounded-xl overflow-hidden h-10 shadow-sm">
              <button
                onClick={() => setShowPercent(false)}
                className={`px-3 text-xs font-semibold h-full transition-colors ${!showPercent ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label={`Show values in ${currency}`}
              >
                {currency}
              </button>
              <button
                onClick={() => setShowPercent(true)}
                className={`px-3.5 text-xs font-semibold h-full transition-colors ${showPercent ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Show percentages"
              >
                %
              </button>
              </div>
            </div>
          )}

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
            />
          ) : chartType === "analyses" ? (
            <AnalysisPanel stats={stats} currency={currency} />
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
    </div>
  );
};

export default Index;
