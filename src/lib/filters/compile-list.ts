import "server-only";
import {
  and,
  between,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInArray,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { relativeRangeMs } from "./relative-range";
import {
  isRelativeValue,
  type Filter,
  type FilterDataType,
  type FilterOp,
} from "./types";

export type ListFilterField = {
  id: string;
  dataType: FilterDataType;
  ops: readonly FilterOp[];
  enumValues?: string[];
  column: AnyColumn | SQL;
};

export type ListFilterFieldMap = Record<string, ListFilterField>;

type ColumnLike = AnyColumn | SQL;

/** Compose a Drizzle WHERE clause from a flat list of Filter objects.
 *  Mirrors the safety posture of `src/lib/reports/compile.ts`:
 *   - unknown propertyIds are dropped silently
 *   - ops not in the field's whitelist are dropped (defends against stale
 *     URLs and bad upstream input)
 */
export function compileListFilters(
  filters: Filter[],
  fields: ListFilterFieldMap,
): SQL | undefined {
  const parts: SQL[] = [];
  for (const f of filters) {
    const field = fields[f.propertyId];
    if (!field) continue;
    if (!field.ops.includes(f.op)) continue;
    const w = buildFilter(f, field);
    if (w) parts.push(w);
  }
  if (parts.length === 0) return undefined;
  return and(...parts);
}

function toDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const s = v.length === 10 ? `${v}T00:00:00` : v;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}
function toEndOfDay(v: unknown): Date | null {
  const d = toDate(v);
  return d ? new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1) : null;
}

function buildFilter(
  filter: Filter,
  field: ListFilterField,
): SQL | undefined {
  // Skip incomplete filters — every op except isnull/notnull needs a value.
  if (
    filter.op !== "isnull" &&
    filter.op !== "notnull" &&
    filter.value === undefined
  ) {
    return undefined;
  }
  if (typeof filter.value === "string" && filter.value === "") {
    if (
      filter.op === "eq" ||
      filter.op === "neq" ||
      filter.op === "contains" ||
      filter.op === "starts-with" ||
      filter.op === "lt" ||
      filter.op === "lte" ||
      filter.op === "gt" ||
      filter.op === "gte"
    ) {
      return undefined;
    }
  }

  const col = field.column as ColumnLike;
  const isDate = field.dataType === "date";
  switch (filter.op) {
    case "eq":
      if (isDate) {
        const aD = toDate(filter.value);
        const bD = toEndOfDay(filter.value);
        if (!aD || !bD) return undefined;
        return between(col as AnyColumn, aD as never, bD as never);
      }
      return eq(col as AnyColumn, filter.value as never);
    case "neq":
      if (isDate) {
        const aD = toDate(filter.value);
        const bD = toEndOfDay(filter.value);
        if (!aD || !bD) return undefined;
        // a < start OR a > end
        return sql`(${col} < ${aD} OR ${col} > ${bD})`;
      }
      return ne(col as AnyColumn, filter.value as never);
    case "lt": {
      const v = isDate ? toDate(filter.value) : filter.value;
      if (v == null) return undefined;
      return lt(col as AnyColumn, v as never);
    }
    case "lte": {
      const v = isDate ? toEndOfDay(filter.value) : filter.value;
      if (v == null) return undefined;
      return lte(col as AnyColumn, v as never);
    }
    case "gt": {
      const v = isDate ? toEndOfDay(filter.value) : filter.value;
      if (v == null) return undefined;
      return gt(col as AnyColumn, v as never);
    }
    case "gte": {
      const v = isDate ? toDate(filter.value) : filter.value;
      if (v == null) return undefined;
      return gte(col as AnyColumn, v as never);
    }
    case "between": {
      if (!Array.isArray(filter.value) || filter.value.length !== 2)
        return undefined;
      const [a, b] = filter.value as [unknown, unknown];
      if (a == null || b == null) return undefined;
      if (isDate) {
        const aD = toDate(a);
        const bD = toEndOfDay(b);
        if (!aD || !bD) return undefined;
        return between(col as AnyColumn, aD as never, bD as never);
      }
      return between(col as AnyColumn, a as never, b as never);
    }
    case "contains":
      if (typeof filter.value !== "string" || filter.value === "")
        return undefined;
      return like(col as AnyColumn, `%${filter.value}%`);
    case "starts-with":
      if (typeof filter.value !== "string" || filter.value === "")
        return undefined;
      return like(col as AnyColumn, `${filter.value}%`);
    case "in": {
      if (!Array.isArray(filter.value) || filter.value.length === 0)
        return undefined;
      return inArray(col as AnyColumn, filter.value as never[]);
    }
    case "not-in": {
      if (!Array.isArray(filter.value) || filter.value.length === 0)
        return undefined;
      return notInArray(col as AnyColumn, filter.value as never[]);
    }
    case "relative": {
      if (!isRelativeValue(filter.value)) return undefined;
      const range = relativeRangeMs(filter.value);
      if (!range) return undefined;
      return between(
        col as AnyColumn,
        new Date(range.start) as never,
        new Date(range.end) as never,
      );
    }
    case "isnull":
      return isNull(col as AnyColumn);
    case "notnull":
      return isNotNull(col as AnyColumn);
  }
  return undefined;
}

