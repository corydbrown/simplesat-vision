import type { z } from "zod";
import type {
  FilterDataTypeSchema,
  FilterOpSchema,
  FilterSchema,
  FilterValueSchema,
  RelativeDirSchema,
  RelativeUnitSchema,
  RelativeValueSchema,
} from "./schemas";

export type FilterDataType = z.infer<typeof FilterDataTypeSchema>;
export type FilterOp = z.infer<typeof FilterOpSchema>;
export type RelativeUnit = z.infer<typeof RelativeUnitSchema>;
export type RelativeDir = z.infer<typeof RelativeDirSchema>;
export type RelativeValue = z.infer<typeof RelativeValueSchema>;
/** FilterValue is `T | undefined` because `value` is `.optional()` on
 *  FilterSchema. The schema itself doesn't include undefined — it's added
 *  here so the `value?:` field on Filter and the helper signatures keep
 *  their existing semantics. */
export type FilterValue = z.infer<typeof FilterValueSchema> | undefined;
export type Filter = z.infer<typeof FilterSchema>;

export const STRING_OPS: readonly FilterOp[] = [
  "contains",
  "starts-with",
  "isnull",
  "notnull",
];

export const NUMERIC_OPS: readonly FilterOp[] = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "between",
  "isnull",
  "notnull",
];

export const DATE_OPS: readonly FilterOp[] = [
  "eq",
  "lt",
  "lte",
  "gt",
  "gte",
  "between",
  "relative",
  "isnull",
  "notnull",
];

export const ENUM_OPS: readonly FilterOp[] = [
  "in",
  "not-in",
  "isnull",
  "notnull",
];

export const BOOLEAN_OPS: readonly FilterOp[] = [
  "eq",
  "neq",
  "isnull",
  "notnull",
];

export const RELATION_OPS: readonly FilterOp[] = [
  "in",
  "not-in",
  "isnull",
  "notnull",
];

// For multi_enum, isnull/notnull are interpreted as "array empty" / "array
// not empty" (json_array_length = 0) rather than column-IS-NULL. The columns
// these filter (e.g. tickets.tags) are NOT NULL with default `[]`.
export const MULTI_ENUM_OPS: readonly FilterOp[] = [
  "contains-any",
  "contains-all",
  "excludes-any",
  "excludes-all",
  "isnull",
  "notnull",
];

export const ALL_FILTER_OPS: readonly FilterOp[] = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "between",
  "in",
  "not-in",
  "contains",
  "starts-with",
  "relative",
  "isnull",
  "notnull",
  "contains-any",
  "contains-all",
  "excludes-any",
  "excludes-all",
];

export function defaultOpsFor(dataType: FilterDataType): readonly FilterOp[] {
  switch (dataType) {
    case "string":
      return STRING_OPS;
    case "number":
      return NUMERIC_OPS;
    case "date":
      return DATE_OPS;
    case "enum":
      return ENUM_OPS;
    case "boolean":
      return BOOLEAN_OPS;
    case "relation":
      return RELATION_OPS;
    case "multi_enum":
      return MULTI_ENUM_OPS;
  }
}

export function opNeedsValue(op: FilterOp): boolean {
  return op !== "isnull" && op !== "notnull";
}

/** Notion-style op labels. Capitalized at the source — call sites render
 *  them as-is, no helper needed. */
export const OP_LABEL: Record<FilterOp, string> = {
  eq: "Is",
  neq: "Is not",
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  between: "Between",
  in: "Is any of",
  "not-in": "Is none of",
  contains: "Contains",
  "starts-with": "Starts with",
  relative: "Is within",
  isnull: "Is empty",
  notnull: "Is not empty",
  "contains-any": "Contains",
  "contains-all": "Contains all",
  "excludes-any": "Missing any",
  "excludes-all": "Does not contain",
};

/** Returns a context-aware op label. Date fields use temporal verbs
 *  ("Is before" / "Is after"). Enums and relations fall through to
 *  OP_LABEL ("Is any of" / "Is none of"). */
export function opLabel(op: FilterOp, dataType: FilterDataType): string {
  if (dataType === "date") {
    switch (op) {
      case "lt":
        return "Is before";
      case "lte":
        return "Is on or before";
      case "gt":
        return "Is after";
      case "gte":
        return "Is on or after";
    }
  }
  return OP_LABEL[op];
}

export function defaultOpFor(dataType: FilterDataType): FilterOp {
  switch (dataType) {
    case "string":
      return "contains";
    case "number":
      return "eq";
    case "date":
      return "eq";
    case "enum":
      return "in";
    case "boolean":
      return "eq";
    case "relation":
      return "in";
    case "multi_enum":
      return "contains-any";
  }
}

export function defaultValueFor(op: FilterOp): FilterValue {
  switch (op) {
    case "between":
      return [0, 0];
    case "in":
    case "not-in":
    case "contains-any":
    case "contains-all":
    case "excludes-any":
    case "excludes-all":
      return [];
    case "relative":
      return { n: 7, unit: "days", dir: "past" } satisfies RelativeValue;
    case "isnull":
    case "notnull":
      return undefined;
    case "eq":
    case "neq":
    case "contains":
    case "starts-with":
      return "";
    case "lt":
    case "lte":
    case "gt":
    case "gte":
      return 0;
  }
}

export function isRelativeValue(v: unknown): v is RelativeValue {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<RelativeValue>;
  return (
    typeof r.n === "number" &&
    (r.unit === "days" || r.unit === "weeks" || r.unit === "months") &&
    (r.dir === "past" || r.dir === "next")
  );
}

/** Whether a filter row carries an effective value. Mirrors the rendering
 *  logic in FilterChip's value label: a fresh "Channel contains" with no
 *  value chosen is inactive; "Channel is empty" (isnull/notnull) is active. */
export function isFilterActive(filter: Filter): boolean {
  if (!opNeedsValue(filter.op)) return true;
  const v = filter.value;
  if (v == null || v === "") return false;
  if (Array.isArray(v)) {
    if (v.length === 0) return false;
    if (filter.op === "between" && v.length === 2) {
      const [a, b] = v as [unknown, unknown];
      if (a == null || b == null) return false;
    }
    return true;
  }
  return true;
}
