"use client";

import { X } from "lucide-react";
import { findField } from "@/lib/reports/pivot-fields";
import type {
  BaseEntity,
  FilterDef,
  FilterOp,
} from "@/lib/reports/types";

const OP_LABEL: Record<FilterOp, string> = {
  eq: "=",
  neq: "≠",
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  in: "in",
  "not-in": "not in",
  isnull: "is null",
  notnull: "is not null",
};

export function FilterChip({
  base,
  filter,
  onRemove,
}: {
  base: BaseEntity;
  filter: FilterDef;
  onRemove: () => void;
}) {
  const field = findField(base, filter.propertyId);
  if (!field) return null;
  const valueLabel =
    filter.op === "isnull" || filter.op === "notnull"
      ? null
      : Array.isArray(filter.value)
        ? filter.value.join(", ")
        : String(filter.value ?? "");

  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-sm h-8">
      <span className="text-foreground">{field.label}</span>
      <span className="text-muted-foreground">{OP_LABEL[filter.op]}</span>
      {valueLabel != null && (
        <span className="text-foreground">{valueLabel}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <X size={12} />
      </button>
    </div>
  );
}
