"use client";

import { useSyncExternalStore } from "react";

export function isMac(): boolean {
  if (typeof navigator === "undefined") return true;
  const uaData = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData;
  const source = uaData?.platform || navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/.test(source);
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
