import { sql, type SQL } from "drizzle-orm";
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

function buildFilter(
  filter: Filter,
  field: PivotField,
): SQL | undefined {
  const col = sql.raw(field.groupExpr);
  switch (filter.op) {
    case "eq":
      return sql`${col} = ${filter.value}`;
    case "neq":
      return sql`${col} <> ${filter.value}`;
    case "lt":
      return sql`${col} < ${filter.value}`;
    case "lte":
      return sql`${col} <= ${filter.value}`;
    case "gt":
      return sql`${col} > ${filter.value}`;
    case "gte":
      return sql`${col} >= ${filter.value}`;
    case "between": {
      if (!Array.isArray(filter.value) || filter.value.length !== 2)
        return undefined;
      const [a, b] = filter.value as [unknown, unknown];
      if (a == null || b == null) return undefined;
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
      // Date-relative — only meaningful when groupExpr is a millisecond
      // timestamp column. We compare against (current epoch ms +/- delta).
      if (!isRelativeValue(filter.value)) return undefined;
      const { n, unit, dir } = filter.value;
      const unitMs =
        unit === "days"
          ? 24 * 60 * 60 * 1000
          : unit === "weeks"
            ? 7 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000; // months ~= 30 days; good enough for the prototype
      const deltaMs = n * unitMs;
      if (dir === "past") {
        // Window: [now - delta, now]
        return sql`${col} >= (CAST(strftime('%s','now') AS INTEGER) * 1000 - ${deltaMs}) AND ${col} <= (CAST(strftime('%s','now') AS INTEGER) * 1000)`;
      }
      // Future window: [now, now + delta]
      return sql`${col} >= (CAST(strftime('%s','now') AS INTEGER) * 1000) AND ${col} <= (CAST(strftime('%s','now') AS INTEGER) * 1000 + ${deltaMs})`;
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
