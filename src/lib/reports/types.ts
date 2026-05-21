import type { Filter } from "@/lib/filters/types";

export type BaseEntity = "ticket" | "customer" | "team_member" | "response";

export type DateBucket = "day" | "week" | "month" | "quarter" | "year";

export type Aggregation = "count" | "sum" | "avg" | "min" | "max";

export type { FilterOp } from "@/lib/filters/types";

export type SortDirection = "asc" | "desc";

export type AxisFieldSort =
  | { by: "field"; direction: SortDirection }
  | { by: "value"; valueIndex: number; direction: SortDirection };

export const DEFAULT_AXIS_SORT: AxisFieldSort = {
  by: "field",
  direction: "asc",
};

export type AxisField = {
  propertyId: string;
  bucket?: DateBucket;
  sort?: AxisFieldSort;
};

export type ValueDef = {
  propertyId: string; // "*" for count-of-records
  agg: Aggregation;
  label?: string;
};

/** @deprecated use Filter from @/lib/filters/types */
export type FilterDef = Filter;

export type ReportConfig = {
  base: BaseEntity;
  rows: AxisField[]; // length 0..2
  columns: AxisField[]; // length 0..1
  values: ValueDef[]; // length 1..3
  filters: Filter[];
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
