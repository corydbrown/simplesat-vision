"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export function InlineAxis({
  id,
  label,
  max,
  current,
  trigger,
  children,
}: {
  id: "rows" | "columns" | "values" | "filters";
  label: string;
  max?: number;
  current: number;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id, data: { axis: id } });
  const atCapacity = max != null && current >= max;
  const empty = current === 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors",
        isOver && !atCapacity
          ? "bg-primary/10 ring-1 ring-primary"
          : empty
            ? "bg-muted/30"
            : "bg-card",
      )}
    >
      <span className="text-sm font-medium text-muted-foreground shrink-0">
        {label}
        {max != null && (
          <span className="ml-1 text-muted-foreground/60">
            {current}/{max}
          </span>
        )}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {children}
        {!atCapacity && trigger}
      </div>
    </div>
  );
}
