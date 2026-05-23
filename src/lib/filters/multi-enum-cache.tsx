"use client";

import { useEffect, useState } from "react";
import {
  fetchMultiEnumValues,
  type MultiEnumValueOption,
} from "./multi-enum-values";

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
  const p = fetchMultiEnumValues(key).then((options) => {
    prime(key, options);
    inFlight.delete(key);
    return options;
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
