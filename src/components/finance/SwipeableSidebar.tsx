import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const SIDEBAR_WIDTH = 320;
const SWIPE_THRESHOLD = 6;

interface Props {
  sidebar: (close: () => void) => ReactNode;
  children: (controls: { open: () => void; isOpen: boolean }) => ReactNode;
}

// Let a scrollable table consume the gesture while it can still scroll in that direction.
function canScrollHorizontally(target: Element, surface: HTMLElement, deltaX: number) {
  for (let element = target; element !== surface; element = element.parentElement) {
    if (!element) break;
    const { overflowX } = getComputedStyle(element);
    if (!/auto|scroll/.test(overflowX) || element.scrollWidth <= element.clientWidth) continue;
    if (deltaX > 0 ? element.scrollLeft > 0 : element.scrollLeft < element.scrollWidth - element.clientWidth - 1) {
      return true;
    }
  }
  return false;
}

export default function SwipeableSidebar({ sidebar, children }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const setOpen = useCallback((open: boolean) => {
    openRef.current = open;
    const surface = surfaceRef.current;
    if (surface) {
      delete surface.dataset.sidebarDragging;
      surface.style.setProperty("--sidebar-progress", open ? "1" : "0");
    }
    setIsDragging(false);
    setIsOpen(open);
  }, []);

  useLayoutEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    drawer.inert = !isOpen && !isDragging;
    if (drawer.inert && drawer.contains(document.activeElement)) {
      surfaceRef.current?.querySelector<HTMLButtonElement>('[aria-controls="finance-sidebar"]')?.focus();
    }
  }, [isOpen, isDragging]);

  useEffect(() => {
    const surface = surfaceRef.current;
    const drawer = drawerRef.current;
    if (!surface || !drawer) return;

    let gesture: {
      id: number;
      target: Element;
      startX: number;
      startY: number;
      startOpen: boolean;
      startOffset: number;
      offset: number;
      lastX: number;
      lastTime: number;
      velocity: number;
      dragging: boolean;
    } | null = null;
    let suppressClickUntil = 0;

    const cancel = () => {
      if (!gesture) return;
      const { startOpen, dragging } = gesture;
      gesture = null;
      if (dragging) {
        suppressClickUntil = performance.now() + 400;
        setOpen(startOpen);
      }
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        cancel();
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('[data-sidebar-swipe-ignore], .touch-none, input[type="range"], [role="slider"]')) return;
      // Keep text selection and caret movement available in the field being edited.
      if (target === document.activeElement && target.closest('input, textarea, [contenteditable="true"]')) return;
      const touch = event.touches[0];
      suppressClickUntil = 0;
      gesture = {
        id: touch.identifier,
        target,
        startX: touch.clientX,
        startY: touch.clientY,
        startOpen: openRef.current,
        startOffset: 0,
        offset: 0,
        lastX: touch.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
        dragging: false,
      };
    };

    const onMove = (event: TouchEvent) => {
      if (!gesture) return;
      if (event.touches.length !== 1 || !event.cancelable) {
        cancel();
        return;
      }
      const touch = Array.from(event.touches).find((touch) => touch.identifier === gesture.id);
      if (!touch) return;
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      if (!gesture.dragging) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) return;
        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          gesture = null;
          return;
        }
        if (Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
        if (canScrollHorizontally(gesture.target, surface, deltaX)) {
          gesture = null;
          return;
        }
        // Read the visible position so a new swipe can interrupt a settling animation.
        gesture.startOffset = Math.max(0, Math.min(SIDEBAR_WIDTH, drawer.getBoundingClientRect().right - surface.getBoundingClientRect().left));
        if ((gesture.startOffset === 0 && deltaX < 0) || (gesture.startOffset === SIDEBAR_WIDTH && deltaX > 0)) {
          gesture = null;
          return;
        }
        gesture.dragging = true;
        surface.dataset.sidebarDragging = "true";
        setIsDragging(true);
      }

      event.preventDefault();
      const elapsed = event.timeStamp - gesture.lastTime;
      if (elapsed > 0) gesture.velocity = (touch.clientX - gesture.lastX) / elapsed;
      gesture.lastX = touch.clientX;
      gesture.lastTime = event.timeStamp;
      gesture.offset = Math.max(0, Math.min(SIDEBAR_WIDTH, gesture.startOffset + deltaX));
      // Update only the composited drawer/backdrop, without rerendering charts on every move.
      surface.style.setProperty("--sidebar-progress", String(gesture.offset / SIDEBAR_WIDTH));
    };

    const onEnd = (event: TouchEvent) => {
      if (!gesture || !Array.from(event.changedTouches).some((touch) => touch.identifier === gesture.id)) return;
      const finished = gesture;
      gesture = null;
      if (!finished.dragging) return;
      const quickSwipe = event.timeStamp - finished.lastTime < 100
        && Math.abs(finished.lastX - finished.startX) >= 24
        && Math.abs(finished.velocity) >= 0.45;
      suppressClickUntil = performance.now() + 400;
      setOpen(quickSwipe ? finished.velocity > 0 : finished.offset >= SIDEBAR_WIDTH / 2);
    };

    const onClick = (event: MouseEvent) => {
      if (performance.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      cancel();
      setOpen(false);
    };

    surface.addEventListener("touchstart", onStart, { passive: true });
    surface.addEventListener("touchmove", onMove, { passive: false });
    surface.addEventListener("touchend", onEnd);
    surface.addEventListener("touchcancel", cancel);
    surface.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      surface.removeEventListener("touchstart", onStart);
      surface.removeEventListener("touchmove", onMove);
      surface.removeEventListener("touchend", onEnd);
      surface.removeEventListener("touchcancel", cancel);
      surface.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setOpen]);

  const active = isOpen || isDragging;

  return (
    <div ref={surfaceRef} className="finance-sidebar-layout relative flex h-[100dvh] overflow-hidden" data-sidebar-active={active}>
      <div
        className="finance-sidebar-backdrop absolute inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="finance-sidebar-slot absolute inset-y-0 left-0 z-50 shrink-0 md:relative md:z-auto">
        <div
          ref={drawerRef}
          id="finance-sidebar"
          className="finance-sidebar-drawer h-full w-[320px] shadow-2xl md:shadow-none"
          aria-hidden={!active}
        >
          {sidebar(() => setOpen(false))}
        </div>
      </div>
      {children({ open: () => setOpen(true), isOpen })}
    </div>
  );
}
