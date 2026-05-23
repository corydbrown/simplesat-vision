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
  or,
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
  enumValuesSource?: "static" | "dynamic";
  dynamicValuesKey?: string;
  column: AnyColumn | SQL;
  /** For multi_enum: SQL expression applied to each json_each() row to extract
   *  a comparable scalar. Defaults to `value` (string arrays). Provide
   *  `json_extract(value, '$.topic')` etc. for arrays of objects. */
  jsonValueExpr?: SQL;
};

export type ListFilterFieldMap = Record<string, ListFilterField>;

type ColumnLike = AnyColumn | SQL;

/** Compose a Drizzle WHERE clause from a flat list of Filter objects.
 *  Mirrors the safety posture of `src/lib/reports/compile.ts`:
 *   - unknown propertyIds are dropped silently
 *   - ops not in the field's whitelist are dropped (defends against stale
 *     URLs and bad upstream input)
 *
 *  Each row carries an optional `combinator` ("AND" | "OR") that describes
 *  how it combines with the PREVIOUS row's accumulated expression. Absent
 *  on the first row; absent on subsequent rows defaults to AND so existing
 *  saved views + URLs stay backwards-compatible. The fold is left-to-right
 *  associative — `A OR B AND C` evaluates as `(A OR B) AND C`. Nested
 *  precedence (`A AND (B OR C)`) is intentionally not supported here; that's
 *  the long-term shape (option B in SVP-80) once the team needs it.
 */
export function compileListFilters(
  filters: Filter[],
  fields: ListFilterFieldMap,
): SQL | undefined {
  let acc: SQL | undefined;
  for (const f of filters) {
    const field = fields[f.propertyId];
    if (!field) continue;
    if (!field.ops.includes(f.op)) continue;
    const w = buildFilter(f, field);
    if (!w) continue;
    if (acc === undefined) {
      acc = w;
      continue;
    }
    acc = f.combinator === "OR" ? or(acc, w) : and(acc, w);
  }
  return acc;
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

  if (field.dataType === "multi_enum") {
    return buildMultiEnumFilter(filter, field);
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

/** SQL compile for multi_enum (JSON-array) filters. Uses correlated EXISTS
 *  subqueries over json_each(col). The column ref is a literal SQL fragment
 *  (e.g. sql`tickets.tags`) per CLAUDE.md — interpolating ${schema.table.col}
 *  inside a correlated subquery produces a parameter placeholder, not a
 *  column reference. `jsonValueExpr` defaults to `value` (string arrays);
 *  for object arrays, callers pass `json_extract(value, '$.topic')`. */
function buildMultiEnumFilter(
  filter: Filter,
  field: ListFilterField,
): SQL | undefined {
  const col = field.column as ColumnLike;
  const valueExpr = field.jsonValueExpr ?? sql`value`;

  if (filter.op === "isnull") {
    // multi_enum columns are NOT NULL with default `[]` — "empty" means
    // zero array entries.
    return sql`json_array_length(${col}) = 0`;
  }
  if (filter.op === "notnull") {
    return sql`json_array_length(${col}) > 0`;
  }

  if (
    filter.op !== "contains-any" &&
    filter.op !== "contains-all" &&
    filter.op !== "excludes-any" &&
    filter.op !== "excludes-all"
  ) {
    return undefined;
  }

  if (!Array.isArray(filter.value) || filter.value.length === 0) {
    return undefined;
  }
  const values = filter.value as (string | number)[];
  const valueList = sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );

  switch (filter.op) {
    case "contains-any":
      return sql`EXISTS (SELECT 1 FROM json_each(${col}) WHERE ${valueExpr} IN (${valueList}))`;
    case "excludes-all":
      return sql`NOT EXISTS (SELECT 1 FROM json_each(${col}) WHERE ${valueExpr} IN (${valueList}))`;
    case "contains-all": {
      // AND of per-value EXISTS — row matches only when every selected value
      // appears at least once in the array.
      const parts = values.map(
        (v) =>
          sql`EXISTS (SELECT 1 FROM json_each(${col}) WHERE ${valueExpr} = ${v})`,
      );
      return sql`(${sql.join(parts, sql` AND `)})`;
    }
    case "excludes-any": {
      // At least one selected value is missing from the array (inverse of
      // contains-all).
      const parts = values.map(
        (v) =>
          sql`NOT EXISTS (SELECT 1 FROM json_each(${col}) WHERE ${valueExpr} = ${v})`,
      );
      return sql`(${sql.join(parts, sql` OR `)})`;
    }
  }
}

