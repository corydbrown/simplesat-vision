import "server-only";
import type { AnyColumn, SQL } from "drizzle-orm";
import type { PropertyFilter } from "@/lib/properties/types";
import type { ListFilterField, ListFilterFieldMap } from "./compile-list";

/** Column spec form used by buildFilterFields. Scalar columns pass a Drizzle
 *  column or SQL fragment directly; multi_enum JSON-array columns wrap with
 *  multiEnumColumn() to carry the json_each value-extraction expression. */
export type FilterColumnSpec =
  | AnyColumn
  | SQL
  | {
      readonly __filterColumnSpec: "multi_enum";
      column: SQL;
      jsonValueExpr: SQL;
    };

/** Tag a JSON-array column for multi_enum compilation. The `column` SQL is
 *  the literal table.column reference (e.g. sql`tickets.tags`) — see
 *  CLAUDE.md → Conventions on why we use a literal here rather than
 *  ${schema.table.column} interpolation. `jsonValueExpr` is the SQL applied
 *  to each json_each() row to produce a comparable scalar (defaults to
 *  `value`; use `json_extract(value, '$.topic')` for object arrays). */
export function multiEnumColumn(
  column: SQL,
  jsonValueExpr: SQL,
): {
  readonly __filterColumnSpec: "multi_enum";
  column: SQL;
  jsonValueExpr: SQL;
} {
  return { __filterColumnSpec: "multi_enum", column, jsonValueExpr };
}

function isMultiEnumColumn(
  spec: FilterColumnSpec,
): spec is {
  readonly __filterColumnSpec: "multi_enum";
  column: SQL;
  jsonValueExpr: SQL;
} {
  return (
    typeof spec === "object" &&
    spec !== null &&
    "__filterColumnSpec" in spec &&
    (spec as { __filterColumnSpec: string }).__filterColumnSpec === "multi_enum"
  );
}

/** Compose a server-side `ListFilterFieldMap` from a shared filter spec map
 *  and a parallel column map. The generic `K extends string` ensures the
 *  column map covers every spec key — add a property to the spec without a
 *  column ref and TypeScript will catch it here. */
export function buildFilterFields<K extends string>(
  specs: Record<K, PropertyFilter>,
  columns: Record<K, FilterColumnSpec>,
): ListFilterFieldMap {
  const result: Record<string, ListFilterField> = {};
  for (const id of Object.keys(specs) as K[]) {
    const colSpec = columns[id];
    if (isMultiEnumColumn(colSpec)) {
      result[id] = {
        id,
        ...specs[id],
        column: colSpec.column,
        jsonValueExpr: colSpec.jsonValueExpr,
      };
    } else {
      result[id] = { id, ...specs[id], column: colSpec };
    }
  }
  return result;
}
