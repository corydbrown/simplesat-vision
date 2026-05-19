export type BaseEntity = "ticket" | "customer" | "team_member" | "response";

export type DateBucket = "day" | "week" | "month" | "quarter" | "year";

export type Aggregation = "count" | "sum" | "avg" | "min" | "max";

export type FilterOp =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "not-in"
  | "isnull"
  | "notnull";

export type AxisField = {
  propertyId: string;
  bucket?: DateBucket;
};

export type ValueDef = {
  propertyId: string; // "*" for count-of-records
  agg: Aggregation;
  label?: string;
};

export type FilterDef = {
  propertyId: string;
  op: FilterOp;
  value?: unknown;
};

export type ReportConfig = {
  base: BaseEntity;
  rows: AxisField[]; // length 0..2
  columns: AxisField[]; // length 0..1
  values: ValueDef[]; // length 1..3
  filters: FilterDef[];
};

export const MAX_ROWS = 2;
export const MAX_COLUMNS = 1;
export const MAX_VALUES = 3;

export const DEFAULT_VALUE: ValueDef = { propertyId: "*", agg: "count" };

export function defaultConfig(base: BaseEntity): ReportConfig {
  return {
    base,
    rows: [],
    columns: [],
    values: [DEFAULT_VALUE],
    filters: [],
  };
}

export const BASE_ENTITY_LABEL: Record<BaseEntity, string> = {
  ticket: "Tickets",
  customer: "Customers",
  team_member: "Team members",
  response: "Responses",
};
