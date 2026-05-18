import type { ReactNode } from "react";

export type Property<T> = {
  id: string;
  label: string;
  width: number;
  group?: string;
  alwaysVisible?: boolean;
  defaultVisible?: boolean;
  sortable?: boolean;
  sortKey?: string;
  truncate?: boolean;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
  detail?: (row: T) => ReactNode;
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
