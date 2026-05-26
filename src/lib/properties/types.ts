import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import type { z } from "zod";
import type { DynamicValuesKey } from "@/lib/filters/multi-enum-resolvers";
import type { FilterDataType, FilterOp } from "@/lib/filters/types";
import type { ColumnStateSchema } from "./schemas";

export type PropertyFilter = {
  dataType: FilterDataType;
  ops: readonly FilterOp[];
  enumValues?: string[];
  /** For enum / multi_enum: where the candidate values come from. `static`
   *  (default) uses the hardcoded `enumValues` list. `dynamic` fetches the
   *  distinct values currently present in the DB via fetchMultiEnumValues,
   *  keyed by `dynamicValuesKey`. */
  enumValuesSource?: "static" | "dynamic";
  /** Required when enumValuesSource is "dynamic". Constrained to keys of
   *  the central multi-enum resolver registry, so an unregistered key
   *  fails at type-check rather than silently returning []. */
  dynamicValuesKey?: DynamicValuesKey;
};

/** Lucide icon component (or any equivalent renderer). Sized + colored by the
 *  consumer; the property only supplies the glyph. */
export type PropertyIcon = ComponentType<LucideProps>;

export type Property<T> = {
  id: string;
  label: string;
  width: number;
  /** Lucide icon rendered next to the property label in PropertiesPanel and
   *  in property pickers (sort, columns, filter). Core fields use semantic
   *  icons (Mail, Phone, Calendar, Hash, ...). Custom / synced fields all
   *  use the same arrows icon to signal "came from an integration." */
  icon: PropertyIcon;
  /** Which entity this property semantically belongs to. The row's own entity
   *  renders first in PropertiesPanel; everything else is a rollup section
   *  (e.g. on a Customer row, "Tickets" gathers ticket-count rollups and
   *  "Responses" gathers avg-rating rollups). Replaces the old free-text
   *  `group` field — grouping is now entity-driven, not bespoke. */
  sourceEntity: string;
  alwaysVisible?: boolean;
  defaultVisible?: boolean;
  sortable?: boolean;
  /** Client-side sort accessor. Required when `sortable: true` so embedded
   *  tables (which sort in memory rather than re-fetching) can order rows. */
  sortValue?: (row: T) => string | number | Date | null;
  /** Shape of the rendered cell. `"text"` cells (spans wrapping a string,
   *  number, or date) get `text-overflow: ellipsis` so long strings clip with
   *  a `…`. `"component"` cells (pills, badges, tag lists, composite widgets)
   *  get plain `overflow: hidden` so they clip cleanly without an ellipsis
   *  appearing next to a pill at narrow widths. Defaults to `"text"` —
   *  component cells opt in explicitly so a freshly added text property is
   *  safe-by-default (ellipsis applies). */
  kind?: "text" | "component";
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
  detail?: (row: T) => ReactNode;
  /** When present, this property can be filtered via the shared <FilterRow />.
   *  Drizzle column refs live in a parallel server-only field map per entity. */
  filter?: PropertyFilter;
  /** When true, this property appears in the Group-by popover. Requires
   *  groupValue. Drizzle column refs live in a parallel server-only field
   *  map per entity (mirrors filter/sort). */
  groupable?: boolean;
  /** Extracts the raw grouping key from a row. Return null for the "(None)"
   *  bucket. Must be defined when groupable is true. */
  groupValue?: (row: T) => string | null;
  /** Optional pretty rendering of a group value in the section header.
   *  Defaults to the raw string value. */
  groupLabel?: (value: string) => ReactNode;
  /** Label for the null bucket. Defaults to "(None)". */
  nullGroupLabel?: string;
};

export type ColumnState = z.infer<typeof ColumnStateSchema>;

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
