// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SwipeableSidebar from "@/components/finance/SwipeableSidebar";

afterEach(cleanup);

function setup() {
  const click = vi.fn();
  const renderContent = vi.fn();
  const view = render(
    <SwipeableSidebar sidebar={(close) => (
      <aside>
        <button onClick={close}>Close sidebar</button>
        <input aria-label="Budget name" />
      </aside>
    )}>
      {({ open, isOpen }) => {
        renderContent();
        return (
          <main>
            <button onClick={open} aria-controls="finance-sidebar" aria-expanded={isOpen}>Open sidebar</button>
            <button onClick={click}>Chart control</button>
            <div data-testid="chart">Chart area</div>
            <div data-testid="scroller" style={{ overflowX: "auto" }}>Wide table</div>
            <div className="touch-none" data-testid="resize">Resize column</div>
          </main>
        );
      }}
    </SwipeableSidebar>,
  );
  const surface = view.container.firstElementChild as HTMLElement;
  const drawer = view.container.querySelector<HTMLElement>("#finance-sidebar")!;
  const progress = () => Number(surface.style.getPropertyValue("--sidebar-progress"));
  vi.spyOn(drawer, "getBoundingClientRect").mockImplementation(() => ({
    right: progress() * 280,
  } as DOMRect));
  return { surface, drawer, progress, click, renderContent };
}

function touch(target: Element, type: string, x: number, y: number, time: number, count = 1, cancelable = true) {
  const event = new Event(type, { bubbles: true, cancelable });
  const point = { identifier: 1, clientX: x, clientY: y };
  Object.defineProperties(event, {
    touches: { value: type === "touchend" || type === "touchcancel" ? [] : Array.from({ length: count }, (_, i) => ({ ...point, identifier: i + 1 })) },
    changedTouches: { value: [point] },
    timeStamp: { value: time },
  });
  act(() => { target.dispatchEvent(event); });
  return event;
}

describe("SwipeableSidebar", () => {
  it("follows partial swipes from the chart, including reversing before release", () => {
    const { surface, drawer, progress, renderContent } = setup();
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 160, 300, 0);
    expect(touch(chart, "touchmove", 188, 302, 200).defaultPrevented).toBe(true);
    expect(progress()).toBeCloseTo(0.1);
    expect(drawer.inert).toBe(false);
    expect(surface.dataset.sidebarDragging).toBe("true");
    const renders = renderContent.mock.calls.length;
    touch(chart, "touchmove", 216, 302, 400);
    expect(progress()).toBeCloseTo(0.2);
    touch(chart, "touchmove", 174, 302, 600);
    expect(progress()).toBeCloseTo(0.05);
    expect(renderContent.mock.calls.length).toBe(renders);
    touch(chart, "touchend", 174, 302, 800);
    expect(progress()).toBe(0);
    expect(drawer.inert).toBe(true);
    expect(surface.dataset.sidebarDragging).toBeUndefined();
  });

  it("settles past halfway open and follows a closing swipe from inside the drawer", () => {
    const { progress, drawer } = setup();
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 100, 300, 0);
    touch(chart, "touchmove", 270, 300, 500);
    touch(chart, "touchend", 270, 300, 700);
    expect(progress()).toBe(1);
    const close = screen.getByRole("button", { name: "Close sidebar" });
    touch(close, "touchstart", 240, 100, 1000);
    touch(close, "touchmove", 100, 100, 1500);
    expect(progress()).toBeCloseTo(0.5);
    touch(close, "touchmove", 60, 100, 1700);
    touch(close, "touchend", 60, 100, 1900);
    expect(progress()).toBe(0);
    expect(drawer.getAttribute("aria-hidden")).toBe("true");
  });

  it("uses a quick flick to open or close even before crossing halfway", () => {
    const { progress } = setup();
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 160, 300, 0);
    touch(chart, "touchmove", 195, 300, 40);
    touch(chart, "touchend", 195, 300, 50);
    expect(progress()).toBe(1);
    touch(chart, "touchstart", 195, 300, 500);
    touch(chart, "touchmove", 160, 300, 540);
    touch(chart, "touchend", 160, 300, 550);
    expect(progress()).toBe(0);
  });

  it("uses the resting position when the finger pauses after a fast move", () => {
    const { progress } = setup();
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 160, 300, 0);
    touch(chart, "touchmove", 195, 300, 40);
    touch(chart, "touchend", 195, 300, 400);
    expect(progress()).toBe(0);
  });

  it("clamps movement at both ends", () => {
    const { progress } = setup();
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 160, 300, 0);
    touch(chart, "touchmove", 600, 300, 500);
    expect(progress()).toBe(1);
    touch(chart, "touchmove", 100, 300, 1000);
    expect(progress()).toBe(0);
  });

  it("leaves vertical scrolling alone for the whole gesture", () => {
    const { progress, surface } = setup();
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 160, 300, 0);
    expect(touch(chart, "touchmove", 164, 330, 100).defaultPrevented).toBe(false);
    expect(touch(chart, "touchmove", 270, 350, 200).defaultPrevented).toBe(false);
    expect(progress()).toBe(0);
    expect(surface.dataset.sidebarDragging).toBeUndefined();
  });

  it("allows taps but suppresses a control click immediately following a swipe", () => {
    const { click, progress } = setup();
    const control = screen.getByRole("button", { name: "Chart control" });
    touch(control, "touchstart", 160, 300, 0);
    touch(control, "touchend", 160, 300, 100);
    fireEvent.click(control);
    expect(click).toHaveBeenCalledTimes(1);
    touch(control, "touchstart", 160, 300, 1000);
    touch(control, "touchmove", 320, 300, 1500);
    touch(control, "touchend", 320, 300, 1700);
    fireEvent.click(control);
    expect(progress()).toBe(1);
    expect(click).toHaveBeenCalledTimes(1);
    touch(control, "touchstart", 160, 300, 2000);
    touch(control, "touchend", 160, 300, 2100);
    fireEvent.click(control);
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("supports buttons, backdrop dismissal, Escape, and returning focus", () => {
    const { progress, drawer, surface } = setup();
    const open = screen.getByRole("button", { name: "Open sidebar" });
    expect(drawer.inert).toBe(true);
    fireEvent.click(open);
    expect(progress()).toBe(1);
    const close = screen.getByRole("button", { name: "Close sidebar" });
    close.focus();
    fireEvent.click(close);
    expect(progress()).toBe(0);
    expect(document.activeElement).toBe(open);
    fireEvent.click(open);
    fireEvent.click(surface.querySelector(".finance-sidebar-backdrop")!);
    expect(progress()).toBe(0);
    fireEvent.click(open);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(progress()).toBe(0);
  });

  it.each([false, true])("restores the starting state on touch cancellation (open: %s)", (open) => {
    const { progress } = setup();
    if (open) fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 160, 300, 0);
    touch(chart, "touchmove", open ? 100 : 220, 300, 200);
    touch(chart, "touchcancel", 220, 300, 300);
    expect(progress()).toBe(open ? 1 : 0);
  });

  it("cancels when a second finger joins and leaves pinch gestures available", () => {
    const { progress } = setup();
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 160, 300, 0);
    touch(chart, "touchmove", 220, 300, 200);
    expect(touch(chart, "touchstart", 220, 300, 250, 2).defaultPrevented).toBe(false);
    expect(progress()).toBe(0);
    expect(touch(chart, "touchmove", 300, 300, 300, 2).defaultPrevented).toBe(false);
  });

  it("keeps horizontal table scrolling available and opens from the table's left edge", () => {
    const { progress } = setup();
    const scroller = screen.getByTestId("scroller");
    Object.defineProperties(scroller, { scrollWidth: { value: 900 }, clientWidth: { value: 300 } });
    scroller.scrollLeft = 200;
    touch(scroller, "touchstart", 160, 300, 0);
    expect(touch(scroller, "touchmove", 220, 300, 200).defaultPrevented).toBe(false);
    expect(progress()).toBe(0);
    touch(scroller, "touchend", 220, 300, 300);
    scroller.scrollLeft = 0;
    touch(scroller, "touchstart", 160, 300, 500);
    expect(touch(scroller, "touchmove", 220, 300, 700).defaultPrevented).toBe(true);
    expect(progress()).toBeCloseTo(60 / 280);
  });

  it("preserves table resizing and text editing gestures", () => {
    const { progress } = setup();
    const resize = screen.getByTestId("resize");
    touch(resize, "touchstart", 160, 300, 0);
    expect(touch(resize, "touchmove", 220, 300, 200).defaultPrevented).toBe(false);
    expect(progress()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));
    const input = screen.getByRole("textbox", { name: "Budget name" });
    input.focus();
    touch(input, "touchstart", 200, 100, 500);
    expect(touch(input, "touchmove", 100, 100, 700).defaultPrevented).toBe(false);
    expect(progress()).toBe(1);
  });

  it("abandons a swipe if native scrolling has already claimed it", () => {
    const { progress } = setup();
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 160, 300, 0);
    touch(chart, "touchmove", 220, 300, 200);
    touch(chart, "touchmove", 240, 300, 300, 1, false);
    expect(progress()).toBe(0);
  });

  it("picks up the visible position when interrupting a settling animation", () => {
    const { progress, drawer } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));
    vi.mocked(drawer.getBoundingClientRect).mockReturnValue({ right: 120 } as DOMRect);
    const chart = screen.getByTestId("chart");
    touch(chart, "touchstart", 200, 300, 0);
    touch(chart, "touchmove", 170, 300, 200);
    expect(progress()).toBeCloseTo(90 / 280);
    touch(chart, "touchend", 170, 300, 400);
    expect(progress()).toBe(0);
  });
});
