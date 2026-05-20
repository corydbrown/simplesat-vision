"use client";

import { useEffect } from "react";

export function useDetailHotkeys({
  onClose,
  onCopyLink,
  onOpenFull,
}: {
  onClose?: () => void;
  onCopyLink?: () => void;
  onOpenFull?: () => void;
}) {
  useEffect(() => {
    function isTextTarget(t: EventTarget | null): boolean {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function onKey(e: KeyboardEvent) {
      if (isTextTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (onClose && e.key === "Escape") {
        onClose();
        return;
      }
      // Require shift NOT pressed so Cmd+Shift+L (theme toggle) doesn't also copy.
      if (onCopyLink && mod && !e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        onCopyLink();
        return;
      }
      if (onOpenFull && mod && !e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        onOpenFull();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onCopyLink, onOpenFull]);
}
