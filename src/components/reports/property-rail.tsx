"use client";

import { useDraggable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { GroupHeading } from "@/components/shared/group-heading";
import { GROUP_ORDER, type PivotField } from "@/lib/reports/pivot-fields";
import { usePivotFields } from "@/lib/reports/use-pivot-fields";
import type { BaseEntity } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { FieldIcon } from "./field-icon";

export type AxisName = "rows" | "columns" | "values" | "filters";

function defaultAxis(field: PivotField): AxisName {
  if (field.valueOnly) return "values";
  if (field.dataType === "number") return "values";
  if (field.dataType === "date") return "columns";
  return "rows";
}

export function PropertyRail({
  base,
  onAddField,
}: {
  base: BaseEntity;
  onAddField: (field: PivotField, axis: AxisName) => void;
}) {
  const fields = usePivotFields()[base];
  const groups = groupBy(fields, (f) => f.group);
  const order = GROUP_ORDER[base];
  const ordered = [
    ...order.filter((g) => groups[g]),
    ...Object.keys(groups).filter((g) => !order.includes(g)),
  ];

  return (
    <div className="flex flex-col gap-4 pr-2">
      {ordered.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <GroupHeading className="px-2 py-0">{group}</GroupHeading>
          {groups[group].map((field) => (
            <RailChip
              key={field.id}
              field={field}
              onClick={() => onAddField(field, defaultAxis(field))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function RailChip({
  field,
  onClick,
}: {
  field: PivotField;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `rail:${field.id}`,
    data: { kind: "rail", fieldId: field.id },
  });

  return (
    <div className="group/chip flex items-center gap-1">
      <button
        type="button"
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm cursor-grab active:cursor-grabbing transition-colors",
          "hover:bg-accent/40",
          isDragging && "opacity-40",
        )}
      >
        <FieldIcon
          dataType={field.dataType}
          className="text-muted-foreground"
        />
        <span className="text-foreground truncate">{field.label}</span>
      </button>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Add ${field.label}`}
        className="rounded-md p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover/chip:opacity-100 transition-opacity cursor-pointer"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}
