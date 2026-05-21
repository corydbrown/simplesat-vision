"use client";

import { useEffect, useState } from "react";
import type { RelationEntity } from "./descriptor";
import { resolveRelationLabels } from "./relation-options";

// Process-lifetime cache of resolved labels, keyed by `${entity}:${id}`.
const labelCache = new Map<string, string>();
const pendingFetches = new Map<RelationEntity, Set<string>>();
const subscribers = new Set<() => void>();

function cacheKey(entity: RelationEntity, id: string) {
  return `${entity}:${id}`;
}

function notify() {
  for (const fn of subscribers) fn();
}

/** Batched fetcher: collect IDs requested within the same tick, then issue
 *  a single resolveRelationLabels call per entity. Prevents N waterfall
 *  requests when many chips render at once. */
function scheduleFetch(entity: RelationEntity, id: string) {
  let bucket = pendingFetches.get(entity);
  if (!bucket) {
    bucket = new Set();
    pendingFetches.set(entity, bucket);
    queueMicrotask(async () => {
      const ids = Array.from(bucket!);
      pendingFetches.delete(entity);
      try {
        const labels = await resolveRelationLabels(entity, ids);
        for (const [k, v] of Object.entries(labels)) {
          labelCache.set(cacheKey(entity, k), v);
        }
      } catch {
        // Swallow — chip will show the ID; user can retry by reopening.
      }
      notify();
    });
  }
  bucket.add(id);
}

/** Hook: returns the resolved label for a relation entity ID, or null while
 *  it's being fetched. Caches across the page lifetime. */
export function useRelationLabel(
  entity: RelationEntity | undefined,
  id: string | null | undefined,
): string | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  if (!entity || !id) return null;
  const key = cacheKey(entity, id);
  if (labelCache.has(key)) return labelCache.get(key)!;
  scheduleFetch(entity, id);
  return null;
}

/** Imperative: prime the cache when the typeahead returns options. Avoids
 *  a redundant fetch when the chip later renders for an ID we just picked. */
export function primeRelationLabel(
  entity: RelationEntity,
  id: string,
  label: string,
) {
  labelCache.set(cacheKey(entity, id), label);
  notify();
}
