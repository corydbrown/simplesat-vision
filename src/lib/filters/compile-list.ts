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
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
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

function buildFilter(
  filter: Filter,
  field: ListFilterField,
): SQL | undefined {
  const col = field.column as ColumnLike;
  switch (filter.op) {
    case "eq":
      return eq(col as AnyColumn, filter.value as never);
    case "neq":
      return ne(col as AnyColumn, filter.value as never);
    case "lt":
      return lt(col as AnyColumn, filter.value as never);
    case "lte":
      return lte(col as AnyColumn, filter.value as never);
    case "gt":
      return gt(col as AnyColumn, filter.value as never);
    case "gte":
      return gte(col as AnyColumn, filter.value as never);
    case "between": {
      if (!Array.isArray(filter.value) || filter.value.length !== 2)
        return undefined;
      const [a, b] = filter.value as [unknown, unknown];
      if (a == null || b == null) return undefined;
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
      // Date-relative — column must be a timestamp_ms integer.
      if (!isRelativeValue(filter.value)) return undefined;
      const { n, unit, dir } = filter.value;
      const unitMs =
        unit === "days"
          ? 24 * 60 * 60 * 1000
          : unit === "weeks"
            ? 7 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000; // months ~= 30 days
      const deltaMs = n * unitMs;
      const nowMs = Date.now();
      if (dir === "past") {
        return and(
          gte(col as AnyColumn, new Date(nowMs - deltaMs) as never),
          lte(col as AnyColumn, new Date(nowMs) as never),
        );
      }
      return and(
        gte(col as AnyColumn, new Date(nowMs) as never),
        lte(col as AnyColumn, new Date(nowMs + deltaMs) as never),
      );
    }
    case "isnull":
      return isNull(col as AnyColumn);
    case "notnull":
      return isNotNull(col as AnyColumn);
  }
  return undefined;
}

