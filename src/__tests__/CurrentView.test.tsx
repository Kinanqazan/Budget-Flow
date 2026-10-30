// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import Index from "@/pages/Index";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ authLoading: false, loading: false, authEnabled: false }) }));
vi.mock("@/hooks/useFinanceData", () => ({ useFinanceData: () => ({ data: {}, stats: {}, currency: "€", currencies: [] }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/finance/SwipeableSidebar", () => ({ default: ({ children }: { children: (state: { open: () => void; isOpen: boolean }) => ReactNode }) => children({ open: () => {}, isOpen: false }) }));
vi.mock("@/components/finance/AuthBar", () => ({ default: ({ onOpenSettings }: { onOpenSettings: () => void }) => <button onClick={onOpenSettings}>Settings</button> }));
vi.mock("@/components/finance/SankeyChart", () => ({ default: () => <div>Flow content</div> }));
vi.mock("@/components/finance/DonutChart", () => ({ default: () => <div>Donut content</div> }));
vi.mock("@/components/finance/FinanceTable", () => ({ default: () => <div>Table content</div> }));
vi.mock("@/components/finance/AnalysisPanel", () => ({ default: () => <div>Analysis content</div> }));
vi.mock("@/components/finance/SettingsPanel", () => ({ default: () => <div>Settings content</div> }));

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("current view on refresh", () => {
  it("falls back to the flow chart for an invalid saved view", () => {
    sessionStorage.setItem("budgetflow-current-view", "invalid");
    render(<Index />);
    expect(screen.getByText("Flow content")).toBeTruthy();
  });
  it.each([["Donut chart", "Donut content"], ["Table View", "Table content"], ["Analysis", "Analysis content"], ["Settings", "Settings content"], ["Flow chart", "Flow content"]])("restores %s", (button, content) => {
    const view = render(<Index />);
    fireEvent.click(screen.getByTitle("Analysis"));
    fireEvent.click(button === "Settings" ? screen.getByText(button) : screen.getByTitle(button));
    expect(screen.getByText(content)).toBeTruthy();
    view.unmount();
    render(<Index />);
    expect(screen.getByText(content)).toBeTruthy();
  });
});
