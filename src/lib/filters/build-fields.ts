import "server-only";
import type { AnyColumn, SQL } from "drizzle-orm";
import type { PropertyFilter } from "@/lib/properties/types";
import type { ListFilterField, ListFilterFieldMap } from "./compile-list";

/** Compose a server-side `ListFilterFieldMap` from a shared filter spec map
 *  and a parallel column map. The generic `K extends string` ensures the
 *  column map covers every spec key — add a property to the spec without a
 *  column ref and TypeScript will catch it here. */
export function buildFilterFields<K extends string>(
  specs: Record<K, PropertyFilter>,
  columns: Record<K, AnyColumn | SQL>,
): ListFilterFieldMap {
  const result: Record<string, ListFilterField> = {};
  for (const id of Object.keys(specs) as K[]) {
    result[id] = { id, ...specs[id], column: columns[id] };
  }
  return result;
}
