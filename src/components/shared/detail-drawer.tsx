"use client";

import { ChevronsRight, GripVertical, Maximize2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { DetailActions } from "./detail-actions";
import { useDetailHotkeys } from "@/lib/use-detail-hotkeys";
import { useModKey } from "@/lib/platform";

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
    return Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH
      ? n
      : DEFAULT_WIDTH;
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
  fullPageHref,
  isOpen,
  onClose,
  children,
}: {
  fullPageHref: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const mod = useModKey();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidth(loadWidth());
  }, []);

  useEffect(() => {
    if (width !== DEFAULT_WIDTH) saveWidth(width);
  }, [width]);

  // Esc and Cmd+Enter live here because they're drawer-specific. Cmd+L
  // is handled by DetailActions (works on standalone pages too).
  useDetailHotkeys({
    onClose: isOpen ? onClose : undefined,
    onOpenFull: isOpen ? () => router.push(fullPageHref) : undefined,
  });

  // Close on outside click. Skip when any Radix popper (dropdown, tooltip,
  // hover card) is currently mounted — the click is dismissing that, not
  // the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!drawerRef.current) return;
      const target = e.target as HTMLElement;
      if (drawerRef.current.contains(target)) return;
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      if (target.closest("[data-drawer-link]")) return;
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      onClose();
    };
    const timer = window.setTimeout(
      () => document.addEventListener("mousedown", onClick),
      150,
    );
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onClick);
    };
  }, [isOpen, onClose]);

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
      style={{
        width,
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
      }}
      className="fixed top-0 right-0 bottom-0 z-40 max-w-full bg-background border-l border-border flex flex-col transition-transform duration-200 ease-out"
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
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Close drawer"
                onClick={onClose}
                className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronsRight size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Close <Kbd>Esc</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={fullPageHref}
                aria-label="Open in full page"
                onClick={onClose}
                className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Maximize2 size={15} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open in full page <Kbd>{mod}</Kbd>
              <Kbd>⏎</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
        <DetailActions entityHref={fullPageHref} />
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
