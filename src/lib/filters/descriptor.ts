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
  /** For enum / multi_enum fields. "dynamic" means the popover fetches
   *  values + counts from the server at open time. */
  enumValuesSource?: "static" | "dynamic";
  /** Routes the dynamic values fetch to a server-side resolver. */
  dynamicValuesKey?: string;
  /** Set on relation-style fields (FK to a named entity). Drives the
   *  typeahead value picker + chip label resolution. */
  entity?: RelationEntity;
};
