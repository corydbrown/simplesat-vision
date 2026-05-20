"use client";

import { useSyncExternalStore } from "react";

export function isMac(): boolean {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

function subscribe() {
  return () => {};
}
function getSnapshot(): string {
  return isMac() ? "⌘" : "Ctrl";
}
function getServerSnapshot(): string {
  return "⌘";
}

// Returns "⌘" on Mac, "Ctrl" elsewhere. Renders "⌘" during SSR and on the
// first client render to match, then resolves after hydration — Windows
// users see a brief swap, Mac users see nothing change.
export function useModKey(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
