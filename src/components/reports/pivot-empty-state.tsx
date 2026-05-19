"use client";

import { Rows3 } from "lucide-react";

export function PivotEmptyState({
  hasBase,
  hasValues = true,
}: {
  hasBase: boolean;
  hasValues?: boolean;
}) {
  const body = !hasBase
    ? "Pick a base entity to start."
    : !hasValues
      ? "Add at least one value to compute, then a row or column to group by."
      : "Drag a property into Rows or Columns, or use the + buttons in each zone.";
  const title = !hasBase
    ? "Pick a base entity to start"
    : !hasValues
      ? "Add a value to begin"
      : "Add a field to begin";

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card text-center">
      <Rows3 size={24} className="text-muted-foreground" />
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-sm text-muted-foreground max-w-sm">{body}</div>
    </div>
  );
}
