"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GROUP_ORDER, type PivotField } from "@/lib/reports/pivot-fields";
import { usePivotFields } from "@/lib/reports/use-pivot-fields";
import type { BaseEntity } from "@/lib/reports/types";
import { FieldIcon } from "./field-icon";

export function AddFieldButton({
  base,
  excluded,
  onAdd,
  label = "Add field",
  allowValueOnly = false,
}: {
  base: BaseEntity;
  excluded: string[];
  onAdd: (field: PivotField) => void;
  label?: string;
  /** When false (default), valueOnly fields are hidden from the picker. */
  allowValueOnly?: boolean;
}) {
  return (
    <AddFieldPopover
      base={base}
      excluded={excluded}
      onAdd={onAdd}
      label={label}
      allowValueOnly={allowValueOnly}
    />
  );
}

function AddFieldPopover({
  base,
  excluded,
  onAdd,
  label = "Add field",
  allowValueOnly,
}: {
  base: BaseEntity;
  excluded: string[];
  onAdd: (field: PivotField) => void;
  label?: string;
  allowValueOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const fields = usePivotFields()[base].filter((f) => {
    if (!allowValueOnly && f.valueOnly) return false;
    if (excluded.includes(f.id)) return false;
    if (!query) return true;
    return f.label.toLowerCase().includes(query.toLowerCase());
  });
  const groups = groupBy(fields, (f) => f.group);
  const order = GROUP_ORDER[base];
  const orderedGroupKeys = [
    ...order.filter((g) => groups[g]),
    ...Object.keys(groups).filter((g) => !order.includes(g)),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer h-8"
        >
          <Plus size={14} />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 max-h-80 overflow-auto p-0"
      >
        <div className="sticky top-0 border-b bg-popover p-2">
          <input
            type="text"
            placeholder="Search fields"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-2 p-2">
          {orderedGroupKeys.map((group) => (
            <div key={group} className="flex flex-col gap-0.5">
              <div className="px-2 pt-1 text-xs font-medium text-muted-foreground/80">
                {group}
              </div>
              {groups[group].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onAdd(f);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-accent cursor-pointer"
                >
                  <FieldIcon
                    dataType={f.dataType}
                    className="text-muted-foreground"
                  />
                  <span className="text-foreground truncate">{f.label}</span>
                </button>
              ))}
            </div>
          ))}
          {fields.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">
              No matching fields.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
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
