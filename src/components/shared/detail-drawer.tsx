"use client";

import { GripVertical, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "simplesat:drawer:width";
const DEFAULT_WIDTH = 720;
const MIN_WIDTH = 360;
const MAX_WIDTH = 1280;

function loadWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = Number(raw);
    return Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH ? n : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function saveWidth(width: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // ignore
  }
}

export function DetailDrawer({
  closeHref,
  children,
}: {
  closeHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);

  // Hydrate persisted width after mount to avoid SSR/CSR mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidth(loadWidth());
  }, []);

  // Persist width changes
  useEffect(() => {
    if (width !== DEFAULT_WIDTH) saveWidth(width);
  }, [width]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  // Close on outside click — but let entity links/buttons navigate first.
  // A deferred document listener avoids firing on the initial open click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!drawerRef.current) return;
      const target = e.target as HTMLElement;
      if (drawerRef.current.contains(target)) return;
      // Allow interactive elements to do their thing; this is how
      // "click an entity pill outside drawer => opens that drawer"
      // continues to work.
      if (
        target.closest(
          "a, button, input, select, textarea, [role='button'], [contenteditable]",
        )
      ) {
        return;
      }
      router.push(closeHref);
    };
    const timer = window.setTimeout(
      () => document.addEventListener("mousedown", onClick),
      150,
    );
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onClick);
    };
  }, [closeHref, router]);

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setResizing(true);
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev: PointerEvent) => {
        const next = startW + (startX - ev.clientX);
        setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next)));
      };
      const onUp = () => {
        setResizing(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [width],
  );

  return (
    <div
      ref={drawerRef}
      style={{ width }}
      className="fixed top-0 right-0 bottom-0 z-40 max-w-full bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
    >
      <div
        onPointerDown={onResizeStart}
        aria-label="Resize drawer"
        role="separator"
        className={`group absolute left-0 top-0 bottom-0 w-2 -translate-x-1/2 cursor-col-resize z-10 flex items-center justify-center ${
          resizing ? "bg-foreground/10" : ""
        }`}
      >
        <GripVertical
          size={14}
          className={`text-muted-foreground/40 transition-opacity ${
            resizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
      </div>
      <div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0">
        <div className="text-xs text-muted-foreground">Detail</div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => router.push(closeHref)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
