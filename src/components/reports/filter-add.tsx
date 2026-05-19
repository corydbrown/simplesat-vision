"use client";

import { ChevronLeft, Plus } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PIVOT_FIELDS,
  type PivotField,
} from "@/lib/reports/pivot-fields";
import type { BaseEntity, FilterDef } from "@/lib/reports/types";
import { FieldIcon } from "./field-icon";

export function FilterAdd({
  base,
  onAdd,
}: {
  base: BaseEntity;
  onAdd: (filter: FilterDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick-field" | "configure">("pick-field");
  const [field, setField] = useState<PivotField | null>(null);
  const [enumChoices, setEnumChoices] = useState<string[]>([]);
  const [valueText, setValueText] = useState("");

  const reset = () => {
    setStep("pick-field");
    setField(null);
    setEnumChoices([]);
    setValueText("");
  };

  const commit = (f: FilterDef) => {
    onAdd(f);
    reset();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer h-8"
        >
          <Plus size={12} />
          Add filter
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {step === "pick-field" && (
          <div className="max-h-80 overflow-auto p-2">
            {PIVOT_FIELDS[base].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setField(f);
                  setStep("configure");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent cursor-pointer"
              >
                <FieldIcon
                  dataType={f.dataType}
                  className="text-muted-foreground"
                />
                <span className="text-foreground truncate">{f.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {f.group}
                </span>
              </button>
            ))}
          </div>
        )}
        {step === "configure" && field && (
          <div className="flex flex-col gap-2 p-2">
            <button
              type="button"
              onClick={() => setStep("pick-field")}
              className="flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <ChevronLeft size={12} />
              Back
            </button>
            <div className="flex items-center gap-2 px-1">
              <FieldIcon
                dataType={field.dataType}
                className="text-muted-foreground"
              />
              <span className="text-sm text-foreground">{field.label}</span>
            </div>

            {field.dataType === "enum" && field.enumValues && (
              <div className="flex flex-col gap-1">
                <div className="px-1 text-xs text-muted-foreground">
                  Include
                </div>
                {field.enumValues.map((v) => {
                  const checked = enumChoices.includes(v);
                  return (
                    <label
                      key={v}
                      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setEnumChoices((prev) =>
                            e.target.checked
                              ? [...prev, v]
                              : prev.filter((p) => p !== v),
                          )
                        }
                      />
                      <span className="text-foreground">{v}</span>
                    </label>
                  );
                })}
                <button
                  type="button"
                  disabled={enumChoices.length === 0}
                  onClick={() =>
                    commit({
                      propertyId: field.id,
                      op: "in",
                      value: enumChoices,
                    })
                  }
                  className="mt-1 self-end rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  Add filter
                </button>
              </div>
            )}

            {field.dataType === "number" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">≤</span>
                  <input
                    type="number"
                    value={valueText}
                    onChange={(e) => setValueText(e.target.value)}
                    placeholder="Value"
                    autoFocus
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  disabled={valueText === ""}
                  onClick={() =>
                    commit({
                      propertyId: field.id,
                      op: "lte",
                      value: Number(valueText),
                    })
                  }
                  className="self-end rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  Add filter
                </button>
              </div>
            )}

            {(field.dataType === "string" ||
              field.dataType === "date" ||
              field.dataType === "relation") && (
              <button
                type="button"
                onClick={() =>
                  commit({ propertyId: field.id, op: "notnull" })
                }
                className="self-end rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                Has value
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
