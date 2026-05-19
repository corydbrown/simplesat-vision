"use client";

import { PropertyList } from "@/components/shared/property-list";
import { useColumnState } from "@/lib/column-prefs";
import type { Property } from "@/lib/properties/types";

export function PropertiesPanel<T>({
  row,
  properties,
  layout = "inline",
}: {
  row: T;
  properties: Property<T>[];
  layout?: "inline" | "stacked";
}) {
  const { state } = useColumnState();

  const groups = new Map<string, Property<T>[]>();
  for (const p of properties) {
    if (state.visibility[p.id] === false) continue;
    const key = p.group ?? "Other";
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  return (
    <PropertyList layout={layout}>
      {[...groups.entries()].map(([groupLabel, props]) => (
        <PropertyList.Group key={groupLabel} label={groupLabel}>
          {props.map((p) => (
            <PropertyList.Row key={p.id} label={p.label}>
              {p.detail ? p.detail(row) : p.cell(row)}
            </PropertyList.Row>
          ))}
        </PropertyList.Group>
      ))}
    </PropertyList>
  );
}
