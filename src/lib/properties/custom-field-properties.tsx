"use client";

import { ArrowRightLeft } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate, formatNumber } from "@/lib/format";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";
import type { CustomFieldDef } from "./custom-fields";
import type { Property } from "./types";

type WithCustomProps = { customProperties: Record<string, unknown> };

const WIDTH_BY_TYPE: Record<CustomFieldDef["dataType"], number> = {
  string: 180,
  number: 130,
  date: 130,
  boolean: 110,
  enum: 150,
};

function customFieldSortValue(
  def: CustomFieldDef,
  raw: unknown,
): string | number | Date | null {
  if (raw === undefined || raw === null || raw === "") return null;
  switch (def.dataType) {
    case "number":
      return typeof raw === "number" ? raw : Number(raw);
    case "boolean":
      return raw ? 1 : 0;
    default:
      return String(raw);
  }
}

function renderValue(
  def: CustomFieldDef,
  raw: unknown,
): ReactNode {
  if (raw === undefined || raw === null || raw === "") {
    return <span className="text-muted-foreground/40">—</span>;
  }
  switch (def.dataType) {
    case "number":
      return (
        <span className="tabular-nums text-muted-foreground">
          {typeof raw === "number" ? formatNumber(raw) : String(raw)}
        </span>
      );
    case "date": {
      const d = typeof raw === "string" ? new Date(raw) : raw;
      const valid = d instanceof Date && !Number.isNaN(d.getTime());
      return (
        <TimestampTooltip date={valid ? (d as Date) : null}>
          <span className="tabular-nums text-muted-foreground">
            {valid ? formatDate(d as Date) : String(raw)}
          </span>
        </TimestampTooltip>
      );
    }
    case "boolean":
      return (
        <span className="text-muted-foreground">
          {raw ? "Yes" : "No"}
        </span>
      );
    default:
      return <span className="text-muted-foreground">{String(raw)}</span>;
  }
}

/** Converts a list of CustomFieldDef into Property entries that read from a
 *  row's `customProperties` JSON. Importance drives default order (higher
 *  first) and default visibility (>=4 visible). All custom fields share the
 *  ArrowRightLeft icon — they all came from an integration sync — and are
 *  tagged with the host entity's `sourceEntity` so they render inside that
 *  entity's section in PropertiesPanel. */
export function customFieldProperties<T extends WithCustomProps>(
  defs: CustomFieldDef[],
  sourceEntity: string,
): Property<T>[] {
  return [...defs]
    .sort((a, b) => b.importance - a.importance)
    .map<Property<T>>((def) => ({
      id: `cf_${def.id}`,
      label: def.label,
      width: WIDTH_BY_TYPE[def.dataType],
      icon: ArrowRightLeft,
      sourceEntity,
      defaultVisible: def.defaultVisible,
      kind: "text",
      align: def.dataType === "number" ? "right" : "left",
      sortable: true,
      sortValue: (row) => customFieldSortValue(def, row.customProperties?.[def.id]),
      cell: (row) => renderValue(def, row.customProperties?.[def.id]),
    }));
}
