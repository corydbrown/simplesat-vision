import type { FilterDataType, FilterOp } from "./types";

/** Entities supported for relation-field typeahead value pickers. */
export type RelationEntity = "customer" | "team_member" | "survey" | "ticket";

/** UI-facing field descriptor consumed by <FilterRow />. Both reports and
 *  list pages produce this via adapters in `./adapters`. */
export type FieldDescriptor = {
  id: string;
  label: string;
  group?: string;
  dataType: FilterDataType;
  ops: readonly FilterOp[];
  enumValues?: string[];
  /** Set on relation-style fields (FK to a named entity). Drives the
   *  typeahead value picker + chip label resolution. */
  entity?: RelationEntity;
};
