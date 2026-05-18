"use client";

import { PropertyRow } from "@/components/shared/property-row";
import { useColumnState } from "@/lib/column-prefs";
import type { Property } from "@/lib/properties/types";

export function PropertiesPanel<T>({
  row,
  properties,
}: {
  row: T;
  properties: Property<T>[];
}) {
  const { state } = useColumnState();

  // Render in registry order (not the user's table reorder), grouped
  // by property.group like a Notion card. Hidden properties hide here
  // too so the table and card stay in sync.
  const groups = new Map<string, Property<T>[]>();
  for (const p of properties) {
    if (state.visibility[p.id] === false) continue;
    const key = p.group ?? "Other";
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  return (
    <div className="divide-y divide-border rounded-md border border-border bg-background">
      {[...groups.entries()].map(([groupLabel, props]) => (
        <div key={groupLabel} className="px-5 py-2">
          <div className="pb-2 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {groupLabel}
          </div>
          {props.map((p) => (
            <PropertyRow key={p.id} label={p.label}>
              {p.detail ? p.detail(row) : p.cell(row)}
            </PropertyRow>
          ))}
        </div>
      ))}
    </div>
  );
}
