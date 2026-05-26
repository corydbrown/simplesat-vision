"use client";

// Client-side cache for multi_enum filter popover options.
//
// Entries are primed lazily on first popover open via `useMultiEnumOptions`
// and live for the lifetime of the JS module — no TTL. That's fine as long as
// nothing mutates the underlying tagged JSON-array columns (tickets.tags,
// responses.topics) without telling us.
//
// Convention: any server action / mutation that changes a tagged JSON-array
// column MUST call `invalidateMultiEnumOptions(key)` for the affected resolver
// key on the client after the round-trip. The next popover open will refetch.
// We prefer explicit invalidation over TTL — TTL masks staleness instead of
// preventing it.

import { useEffect, useState } from "react";
import type { MultiEnumValueOption } from "./multi-enum-types";
import { fetchMultiEnumValues } from "./multi-enum-values";

const optionsCache = new Map<string, MultiEnumValueOption[]>();
const labelCache = new Map<string, string>();
const inFlight = new Map<string, Promise<MultiEnumValueOption[]>>();
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

function labelKey(dynamicValuesKey: string, value: string) {
  return `${dynamicValuesKey}:${value}`;
}

function prime(key: string, options: MultiEnumValueOption[]) {
  optionsCache.set(key, options);
  for (const opt of options) {
    labelCache.set(labelKey(key, opt.value), opt.label);
  }
  notify();
}

async function loadOnce(key: string): Promise<MultiEnumValueOption[]> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = fetchMultiEnumValues(key)
    .then((options) => {
      prime(key, options);
      inFlight.delete(key);
      return options;
    })
    .catch((err) => {
      // Without this catch, a rejected fetch would stay in `inFlight` forever
      // and `prime` would never run — leaving the hook stuck on `loading: true`
      // and the popup permanently at "Loading…". Treat failure as empty.
      console.error(`[multi-enum] fetch failed for key "${key}":`, err);
      prime(key, []);
      inFlight.delete(key);
      return [] as MultiEnumValueOption[];
    });
  inFlight.set(key, p);
  return p;
}

/** Hook: returns cached options for a dynamic multi_enum field, fetching on
 *  first request. `loading` is true only while the initial fetch is in
 *  flight — subsequent renders hit the in-memory cache. */
export function useMultiEnumOptions(dynamicValuesKey: string | undefined): {
  options: MultiEnumValueOption[];
  loading: boolean;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (!dynamicValuesKey) return;
    if (optionsCache.has(dynamicValuesKey)) return;
    void loadOnce(dynamicValuesKey);
  }, [dynamicValuesKey]);

  if (!dynamicValuesKey) return { options: [], loading: false };
  const cached = optionsCache.get(dynamicValuesKey);
  if (cached) return { options: cached, loading: false };
  return { options: [], loading: true };
}

/** Evicts the cached entry for `dynamicValuesKey` (options + labels + any
 *  in-flight fetch) and notifies subscribers so mounted popovers reload on
 *  next render. Call after a server mutation that changes the underlying
 *  tagged JSON-array column. No-ops if the key was never primed. */
export function invalidateMultiEnumOptions(dynamicValuesKey: string): void {
  optionsCache.delete(dynamicValuesKey);
  inFlight.delete(dynamicValuesKey);
  const prefix = `${dynamicValuesKey}:`;
  for (const labelKeyStr of labelCache.keys()) {
    if (labelKeyStr.startsWith(prefix)) labelCache.delete(labelKeyStr);
  }
  notify();
}

// Dev-only console hook for manual cache-eviction verification.
// In a browser dev build: `__simplesatInvalidateMultiEnum('ticket.tags')`.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__simplesatInvalidateMultiEnum =
    invalidateMultiEnumOptions;
}

/** Sync label lookup for chip rendering. Returns null when the dynamic-values
 *  fetch hasn't completed yet — the chip should fall back to the raw value. */
export function getMultiEnumLabel(
  dynamicValuesKey: string | undefined,
  value: string,
): string | null {
  if (!dynamicValuesKey) return null;
  const key = labelKey(dynamicValuesKey, value);
  return labelCache.get(key) ?? null;
}
