"use client";

import type { ReactNode } from "react";
import { formatDate, formatNumber } from "@/lib/format";
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

function renderValue(
  def: CustomFieldDef,
  raw: unknown,
): ReactNode {
  if (raw === undefined || raw === null || raw === "") {
    return <span className="text-muted-foreground">-</span>;
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
        <span className="tabular-nums text-muted-foreground">
          {valid ? formatDate(d as Date) : String(raw)}
        </span>
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
 *  first) and default visibility (>=4 visible). Spread after the entity's
 *  core properties so they sort under the semantic-group buckets. */
export function customFieldProperties<T extends WithCustomProps>(
  defs: CustomFieldDef[],
): Property<T>[] {
  return [...defs]
    .sort((a, b) => b.importance - a.importance)
    .map<Property<T>>((def) => ({
      id: `cf_${def.id}`,
      label: def.label,
      width: WIDTH_BY_TYPE[def.dataType],
      group: def.group,
      defaultVisible: def.defaultVisible,
      align: def.dataType === "number" ? "right" : "left",
      cell: (row) => renderValue(def, row.customProperties?.[def.id]),
    }));
}
