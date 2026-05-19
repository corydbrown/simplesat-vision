"use client";

import { ChevronDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PivotField } from "@/lib/reports/pivot-fields";
import type { Aggregation, AxisField, DateBucket, ValueDef } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { FieldIcon } from "./field-icon";

const BUCKETS: DateBucket[] = ["day", "week", "month", "quarter", "year"];

const AGG_LABELS: Record<Aggregation, string> = {
  count: "Count",
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
};

type AxisChipProps = {
  field: PivotField | "count";
  axis: AxisField | ValueDef;
  onRemove: () => void;
  axisName: "rows" | "columns" | "values" | "filters";
  onUpdate: (next: AxisField | ValueDef) => void;
};

export function AxisChip({
  field,
  axis,
  axisName,
  onRemove,
  onUpdate,
}: AxisChipProps) {
  const isValue = axisName === "values";
  const label = field === "count" ? "Records" : field.label;
  const dataType = field === "count" ? "number" : field.dataType;
  const bucket = !isValue ? (axis as AxisField).bucket : undefined;
  const agg = isValue ? (axis as ValueDef).agg : undefined;

  const summary = bucket ? `by ${bucket}` : agg ? AGG_LABELS[agg] : undefined;

  const hasMenu =
    field !== "count" && (isValue || field.bucketable);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card pl-2 pr-1 py-1 text-sm h-8",
      )}
    >
      <FieldIcon dataType={dataType} className="text-muted-foreground" />
      <span className="text-foreground">{label}</span>

      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer",
            )}
          >
            {summary ?? "Configure"}
            <ChevronDown size={12} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {isValue && (
              <>
                <DropdownMenuLabel>Aggregation</DropdownMenuLabel>
                {field.aggregations.map((a) => (
                  <DropdownMenuCheckboxItem
                    key={a}
                    checked={agg === a}
                    onCheckedChange={() =>
                      onUpdate({ ...(axis as ValueDef), agg: a })
                    }
                  >
                    {AGG_LABELS[a]}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}
            {!isValue && field.bucketable && (
              <>
                <DropdownMenuLabel>Bucket</DropdownMenuLabel>
                {BUCKETS.map((b) => (
                  <DropdownMenuCheckboxItem
                    key={b}
                    checked={bucket === b}
                    onCheckedChange={() =>
                      onUpdate({ ...(axis as AxisField), bucket: b })
                    }
                  >
                    {b}
                  </DropdownMenuCheckboxItem>
                ))}
                {bucket && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() =>
                        onUpdate({
                          ...(axis as AxisField),
                          bucket: undefined,
                        })
                      }
                    >
                      Clear bucket
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {!hasMenu && summary && (
        <span className="text-xs text-muted-foreground">{summary}</span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <X size={12} />
      </button>
    </div>
  );
}
