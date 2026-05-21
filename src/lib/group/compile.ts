import "server-only";
import { asc, desc, sql, type Column, type SQL } from "drizzle-orm";
import type { GroupSpec } from "./types";

/** A groupable column reference. Either a real Drizzle column or a
 *  precomputed SQL expression (e.g. an aggregate from a parent query). */
export type GroupField = Column | SQL<unknown>;
export type GroupFieldMap = Record<string, GroupField>;

/**
 * Returns the orderBy expressions to prepend so that:
 *   1. Rows in the same group are contiguous.
 *   2. Null-group rows always come last.
 *
 * Spread into `.orderBy(...)` BEFORE the existing sort expressions:
 *   .orderBy(...compileGroupOrderBy(spec, fields), <existing-sort>)
 */
export function compileGroupOrderBy(
  spec: GroupSpec | null,
  fields: GroupFieldMap,
): SQL[] {
  if (!spec) return [];
  const field = fields[spec.propertyId];
  if (!field) return [];
  const nullsLast = sql`CASE WHEN ${field} IS NULL THEN 1 ELSE 0 END`;
  return [nullsLast, spec.dir === "asc" ? asc(field) : desc(field)];
}
