export type FilterDataType =
  | "string"
  | "number"
  | "date"
  | "enum"
  | "boolean"
  | "relation";

export type FilterOp =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "between"
  | "in"
  | "not-in"
  | "contains"
  | "starts-with"
  | "relative"
  | "isnull"
  | "notnull";

export type RelativeUnit = "days" | "weeks" | "months";
export type RelativeDir = "past" | "next" | "this";

export type RelativeValue = {
  n: number;
  unit: RelativeUnit;
  dir: RelativeDir;
};

export type FilterValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | [number, number]
  | [string, string]
  | RelativeValue
  | null
  | undefined;

export type Filter = {
  propertyId: string;
  op: FilterOp;
  value?: FilterValue;
};

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
  }
}

export function opNeedsValue(op: FilterOp): boolean {
  return op !== "isnull" && op !== "notnull";
}

/** Default op label (lowercase, natural language). Capitalize at display time. */
export const OP_LABEL: Record<FilterOp, string> = {
  eq: "is",
  neq: "is not",
  lt: "is less than",
  lte: "is at most",
  gt: "is greater than",
  gte: "is at least",
  between: "is between",
  in: "contains",
  "not-in": "does not contain",
  contains: "contains",
  "starts-with": "starts with",
  relative: "is in the",
  isnull: "is empty",
  notnull: "is not empty",
};

/** Capitalize the first letter of a string (for dropdown labels). */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Returns a context-aware op label. Date fields use temporal verbs
 *  ("is before" / "is after"). Enums and relations use the OP_LABEL
 *  defaults ("contains" for in, "does not contain" for not-in). */
export function opLabel(op: FilterOp, dataType: FilterDataType): string {
  if (dataType === "date") {
    switch (op) {
      case "lt":
        return "is before";
      case "lte":
        return "is on or before";
      case "gt":
        return "is after";
      case "gte":
        return "is on or after";
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
  }
}

export function defaultValueFor(op: FilterOp): FilterValue {
  switch (op) {
    case "between":
      return [0, 0];
    case "in":
    case "not-in":
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
