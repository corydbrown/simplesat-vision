"use client";

// Shared state for the left sidebar: width, collapsed/expanded, and the
// global Cmd+\ shortcut. Lives in workspace layout so both PrimaryNavClient
// (renders the sidebar) and SidebarToggle (lives in every Topbar) can read
// and mutate the same state.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 420;
export const SIDEBAR_DEFAULT_WIDTH = 240;
const STORAGE_WIDTH = "simplesat:nav:width";
const STORAGE_COLLAPSED = "simplesat:nav:collapsed-state";

type SidebarValue = {
  width: number;
  collapsed: boolean;
  setWidth: (n: number) => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarValue | null>(null);

export function useSidebar(): SidebarValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used inside <SidebarProvider>");
  }
  return ctx;
}

function clampWidth(n: number): number {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, n));
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [width, setWidthState] = useState<number>(SIDEBAR_DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // One-shot hydration from localStorage after mount. Can't use lazy
  // useState init because localStorage is unavailable during SSR, and
  // useSyncExternalStore doesn't fit because this component also writes
  // to localStorage (setWidth, toggle). The setState calls below run
  // exactly once per mount, not on every state change — this is the
  // documented "initialize React state from an external system" case,
  // not the state-mirroring antipattern the rule guards against.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const w = window.localStorage.getItem(STORAGE_WIDTH);
      if (w) {
        const n = Number(w);
        if (Number.isFinite(n)) setWidthState(clampWidth(n));
      }
      const c = window.localStorage.getItem(STORAGE_COLLAPSED);
      if (c === "1") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setWidth = useCallback((n: number) => {
    const w = clampWidth(n);
    setWidthState(w);
    try {
      window.localStorage.setItem(STORAGE_WIDTH, String(w));
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_COLLAPSED, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Cmd+\ global toggle. Skip when typing in inputs.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <SidebarContext.Provider value={{ width, collapsed, setWidth, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}
