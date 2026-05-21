import { sql, type SQL } from "drizzle-orm";
import { relativeRangeMs } from "@/lib/filters/relative-range";
import { isRelativeValue, type Filter } from "@/lib/filters/types";
import {
  BASE_TABLE,
  bucketSql,
  findField,
  type FieldJoin,
  type PivotField,
} from "./pivot-fields";
import type {
  Aggregation,
  AxisField,
  ReportConfig,
  ValueDef,
} from "./types";

export type CompiledQuery = {
  query: SQL;
  rowAliases: AxisAlias[];
  columnAliases: AxisAlias[];
  valueAliases: string[];
  valueDefs: ValueDef[];
};

export type AxisAlias = {
  alias: string;
  labelAlias?: string;
  field: PivotField;
  bucket?: AxisField["bucket"];
};

function aggExpr(value: ValueDef, field: PivotField | undefined): string {
  if (value.propertyId === "*" || value.agg === "count") {
    return `count(*)`;
  }
  if (!field) return `count(*)`;
  // Pre-aggregated metric expressions (CSAT/CES/NPS, correlated subqueries)
  // are stored verbatim on the field. The user's chosen agg is ignored — the
  // formula already encodes its own aggregation.
  if (field.valueExpr) return field.valueExpr;
  const col = field.groupExpr;
  switch (value.agg) {
    case "sum":
      return `sum(${col})`;
    case "avg":
      return `avg(${col})`;
    case "min":
      return `min(${col})`;
    case "max":
      return `max(${col})`;
  }
}

function axisGroupExpr(axis: AxisField, field: PivotField): string {
  if (field.dataType === "date" && axis.bucket) {
    return bucketSql(field.groupExpr, axis.bucket);
  }
  return field.groupExpr;
}

/** ISO date string ("2026-05-13" or full ISO) → epoch ms, or null. */
function isoToMs(v: unknown): number | null {
  if (typeof v !== "string" || !v) return null;
  // Treat bare YYYY-MM-DD as local midnight.
  const s = v.length === 10 ? `${v}T00:00:00` : v;
  const ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : null;
}
/** End-of-day for a YYYY-MM-DD (inclusive between). */
function endOfDayMs(v: unknown): number | null {
  const ms = isoToMs(v);
  if (ms == null) return null;
  return ms + 24 * 60 * 60 * 1000 - 1;
}

function buildFilter(
  filter: Filter,
  field: PivotField,
): SQL | undefined {
  // Skip incomplete filters — every op except isnull/notnull needs a value.
  if (
    filter.op !== "isnull" &&
    filter.op !== "notnull" &&
    filter.value === undefined
  ) {
    return undefined;
  }
  // Empty strings and empty arrays are also incomplete for ops that look at
  // the value (eq, contains, in, etc.).
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

  const col = sql.raw(field.groupExpr);
  const isDate = field.dataType === "date";
  switch (filter.op) {
    case "eq":
      if (isDate) {
        const startMs = isoToMs(filter.value);
        const endMs = endOfDayMs(filter.value);
        if (startMs == null || endMs == null) return undefined;
        return sql`${col} BETWEEN ${startMs} AND ${endMs}`;
      }
      return sql`${col} = ${filter.value}`;
    case "neq":
      if (isDate) {
        const startMs = isoToMs(filter.value);
        const endMs = endOfDayMs(filter.value);
        if (startMs == null || endMs == null) return undefined;
        return sql`(${col} < ${startMs} OR ${col} > ${endMs})`;
      }
      return sql`${col} <> ${filter.value}`;
    case "lt": {
      if (isDate) {
        const ms = isoToMs(filter.value);
        return ms == null ? undefined : sql`${col} < ${ms}`;
      }
      return sql`${col} < ${filter.value}`;
    }
    case "lte": {
      if (isDate) {
        const ms = endOfDayMs(filter.value);
        return ms == null ? undefined : sql`${col} <= ${ms}`;
      }
      return sql`${col} <= ${filter.value}`;
    }
    case "gt": {
      if (isDate) {
        const ms = endOfDayMs(filter.value);
        return ms == null ? undefined : sql`${col} > ${ms}`;
      }
      return sql`${col} > ${filter.value}`;
    }
    case "gte": {
      if (isDate) {
        const ms = isoToMs(filter.value);
        return ms == null ? undefined : sql`${col} >= ${ms}`;
      }
      return sql`${col} >= ${filter.value}`;
    }
    case "between": {
      if (!Array.isArray(filter.value) || filter.value.length !== 2)
        return undefined;
      const [a, b] = filter.value as [unknown, unknown];
      if (a == null || b == null) return undefined;
      if (isDate) {
        const aMs = isoToMs(a);
        const bMs = endOfDayMs(b);
        if (aMs == null || bMs == null) return undefined;
        return sql`${col} BETWEEN ${aMs} AND ${bMs}`;
      }
      return sql`${col} BETWEEN ${a} AND ${b}`;
    }
    case "contains":
      if (typeof filter.value !== "string" || filter.value === "")
        return undefined;
      return sql`${col} LIKE ${"%" + filter.value + "%"}`;
    case "starts-with":
      if (typeof filter.value !== "string" || filter.value === "")
        return undefined;
      return sql`${col} LIKE ${filter.value + "%"}`;
    case "relative": {
      // Date-relative — column must be a millisecond timestamp. We compute
      // the window's [start, end] in JS and emit a BETWEEN bound query.
      if (!isRelativeValue(filter.value)) return undefined;
      const range = relativeRangeMs(filter.value);
      if (!range) return undefined;
      return sql`${col} BETWEEN ${range.start} AND ${range.end}`;
    }
    case "isnull":
      return sql`${col} IS NULL`;
    case "notnull":
      return sql`${col} IS NOT NULL`;
    case "in": {
      if (!Array.isArray(filter.value) || filter.value.length === 0)
        return undefined;
      const parts = filter.value.map((v) => sql`${v}`);
      return sql`${col} IN (${sql.join(parts, sql.raw(", "))})`;
    }
    case "not-in": {
      if (!Array.isArray(filter.value) || filter.value.length === 0)
        return undefined;
      const parts = filter.value.map((v) => sql`${v}`);
      return sql`${col} NOT IN (${sql.join(parts, sql.raw(", "))})`;
    }
  }
}

export function compileReport(config: ReportConfig): CompiledQuery | null {
  const baseTable = BASE_TABLE[config.base];

  const rowAliases: AxisAlias[] = [];
  const columnAliases: AxisAlias[] = [];
  const valueAliases: string[] = [];
  const joins = new Map<string, FieldJoin>();
  const selectParts: SQL[] = [];
  const groupByParts: SQL[] = [];
  const orderByParts: SQL[] = [];

  const collectJoins = (field: PivotField) => {
    for (const j of field.joins ?? []) {
      if (!joins.has(j.alias)) joins.set(j.alias, j);
    }
  };

  const addAxis = (
    axis: AxisField,
    aliases: AxisAlias[],
    prefix: string,
    index: number,
  ) => {
    const field = findField(config.base, axis.propertyId);
    if (!field) return;
    if (field.valueOnly) return; // compiled-in safety; UI also filters these out
    collectJoins(field);

    const alias = `${prefix}_${index}`;
    const groupExpr = axisGroupExpr(axis, field);
    selectParts.push(sql.raw(`${groupExpr} AS ${alias}`));
    groupByParts.push(sql.raw(groupExpr));
    orderByParts.push(sql.raw(`${alias} ASC NULLS LAST`));

    let labelAlias: string | undefined;
    if (field.labelExpr) {
      labelAlias = `${alias}_label`;
      selectParts.push(sql.raw(`${field.labelExpr} AS ${labelAlias}`));
      groupByParts.push(sql.raw(field.labelExpr));
    }

    aliases.push({ alias, labelAlias, field, bucket: axis.bucket });
  };

  config.rows.forEach((r, i) => addAxis(r, rowAliases, "row", i));
  config.columns.forEach((c, i) => addAxis(c, columnAliases, "col", i));

  if (rowAliases.length === 0 && columnAliases.length === 0) {
    // No grouping at all; can still produce a single grand-total row.
  }

  // Values
  if (config.values.length === 0) {
    selectParts.push(sql.raw(`count(*) AS val_0`));
    valueAliases.push("val_0");
  } else {
    config.values.forEach((v, i) => {
      const field = v.propertyId === "*" ? undefined : findField(config.base, v.propertyId);
      if (field) collectJoins(field);
      const alias = `val_${i}`;
      selectParts.push(sql.raw(`${aggExpr(v, field)} AS ${alias}`));
      valueAliases.push(alias);
    });
  }

  // Filters
  const whereSqls: SQL[] = [];
  for (const f of config.filters) {
    const field = findField(config.base, f.propertyId);
    if (!field) continue;
    // Drop filters whose op isn't in the field's allowed set. This is the
    // last line of defense against bad URL state or AI-generated configs
    // that put aggregate expressions into WHERE (e.g. csat_avg on the
    // response base, which compiles to AVG(...) — invalid in WHERE).
    if (!field.filterOps.includes(f.op)) continue;
    collectJoins(field);
    const w = buildFilter(f, field);
    if (w) whereSqls.push(w);
  }

  const joinSql = Array.from(joins.values())
    .map((j) => j.sql)
    .join(" ");

  const selectSql = sql.join(selectParts, sql.raw(", "));
  const fromSql = sql.raw(`FROM ${baseTable} ${joinSql}`.trim());
  const whereSql =
    whereSqls.length > 0
      ? sql`WHERE ${sql.join(whereSqls, sql.raw(" AND "))}`
      : sql``;
  const groupSql =
    groupByParts.length > 0
      ? sql`GROUP BY ${sql.join(groupByParts, sql.raw(", "))}`
      : sql``;
  const orderSql =
    orderByParts.length > 0
      ? sql`ORDER BY ${sql.join(orderByParts, sql.raw(", "))}`
      : sql``;

  const query = sql`SELECT ${selectSql} ${fromSql} ${whereSql} ${groupSql} ${orderSql} LIMIT 5000`;

  return {
    query,
    rowAliases,
    columnAliases,
    valueAliases,
    valueDefs: config.values.length > 0 ? config.values : [{ propertyId: "*", agg: "count" as Aggregation }],
  };
}
