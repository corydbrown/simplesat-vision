"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PropertyList } from "@/components/shared/property-list";
import { useColumnState } from "@/lib/column-prefs";
import type { Property } from "@/lib/properties/types";

/** Groups properties into sections by `sourceEntity`. The section matching
 *  `rowEntity` renders first (e.g. "Customer" on a customer row), then every
 *  other source entity in first-appearance order (rollups like "Tickets",
 *  "Responses"). Insertion order within a section is preserved.
 *
 *  The "X more properties" toggle at the bottom reveals properties the user
 *  has hidden via the columns dropdown. It's drawer-friendly local state;
 *  collapses back on close. */
export function PropertiesPanel<T>({
  row,
  properties,
  rowEntity,
  layout = "inline",
}: {
  row: T;
  properties: Property<T>[];
  rowEntity: string;
  layout?: "inline" | "stacked";
}) {
  const { state } = useColumnState();
  const [expanded, setExpanded] = useState(false);

  const { visible, hidden } = useMemo(() => {
    const visible: Property<T>[] = [];
    const hidden: Property<T>[] = [];
    for (const p of properties) {
      if (state.visibility[p.id] === false) hidden.push(p);
      else visible.push(p);
    }
    return { visible, hidden };
  }, [properties, state.visibility]);

  const sections = useMemo(() => {
    const shown = expanded ? [...visible, ...hidden] : visible;
    return groupBySource(shown, rowEntity);
  }, [visible, hidden, expanded, rowEntity]);

  return (
    <>
      <PropertyList layout={layout}>
        {sections.map(({ key, props }) => (
          <PropertyList.Group key={key} label={key}>
            {props.map((p) => (
              <PropertyList.Row
                key={p.id}
                icon={p.icon}
                label={p.label}
                copyable={p.kind !== "component"}
              >
                {p.detail ? p.detail(row) : p.cell(row)}
              </PropertyList.Row>
            ))}
          </PropertyList.Group>
        ))}
      </PropertyList>

      {hidden.length > 0 && (
        <div className="pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="-mx-2 h-7 cursor-pointer gap-1.5 px-2 text-sm font-normal text-muted-foreground/70 hover:bg-transparent hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded
              ? `Hide ${hidden.length} ${hidden.length === 1 ? "property" : "properties"}`
              : `${hidden.length} more ${hidden.length === 1 ? "property" : "properties"}`}
          </Button>
        </div>
      )}
    </>
  );
}

/** Returns sections in the order: row's own entity first, then every other
 *  source entity in first-appearance order. Sections with no properties are
 *  omitted. */
function groupBySource<T>(
  properties: Property<T>[],
  rowEntity: string,
): { key: string; props: Property<T>[] }[] {
  const byEntity = new Map<string, Property<T>[]>();
  for (const p of properties) {
    const arr = byEntity.get(p.sourceEntity) ?? [];
    arr.push(p);
    byEntity.set(p.sourceEntity, arr);
  }

  const ordered: { key: string; props: Property<T>[] }[] = [];
  const own = byEntity.get(rowEntity);
  if (own) ordered.push({ key: rowEntity, props: own });
  for (const [key, props] of byEntity) {
    if (key === rowEntity) continue;
    ordered.push({ key, props });
  }
  return ordered;
}
