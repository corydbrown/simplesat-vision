import type { FilterDataType, FilterOp } from "./types";

/** UI-facing field descriptor consumed by <FilterRow />. Both reports and
 *  list pages produce this via adapters in `./adapters`. */
export type FieldDescriptor = {
  id: string;
  label: string;
  group?: string;
  dataType: FilterDataType;
  ops: readonly FilterOp[];
  enumValues?: string[];
};
