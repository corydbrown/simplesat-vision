import type { ReactNode } from "react";
import type { FilterDataType, FilterOp } from "@/lib/filters/types";

export type PropertyFilter = {
  dataType: FilterDataType;
  ops: readonly FilterOp[];
  enumValues?: string[];
};

export type Property<T> = {
  id: string;
  label: string;
  width: number;
  group?: string;
  alwaysVisible?: boolean;
  defaultVisible?: boolean;
  sortable?: boolean;
  /** Client-side sort accessor. Required when `sortable: true` so embedded
   *  tables (which sort in memory rather than re-fetching) can order rows. */
  sortValue?: (row: T) => string | number | Date | null;
  truncate?: boolean;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
  detail?: (row: T) => ReactNode;
  /** When present, this property can be filtered via the shared <FilterRow />.
   *  Drizzle column refs live in a parallel server-only field map per entity. */
  filter?: PropertyFilter;
};

export type ColumnState = {
  visibility: Record<string, boolean>;
  order: string[];
  widths: Record<string, number>;
};

export function defaultColumnState<T>(
  properties: Property<T>[],
): ColumnState {
  return {
    visibility: Object.fromEntries(
      properties.map((p) => [p.id, p.defaultVisible ?? true]),
    ),
    order: properties.map((p) => p.id),
    widths: Object.fromEntries(properties.map((p) => [p.id, p.width])),
  };
}
