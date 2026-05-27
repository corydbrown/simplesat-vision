"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { RotateCcw, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FilterRow } from "@/components/shared/filter-row";
import type { ReportResult } from "@/db/queries/reports";
import { pivotFieldsToDescriptors } from "@/lib/filters/adapters";
import type { Filter } from "@/lib/filters/types";
import { runReportAction } from "@/lib/reports/actions";
import { findField, type PivotField } from "@/lib/reports/pivot-fields";
import { usePivotFields } from "@/lib/reports/use-pivot-fields";
import {
  MAX_COLUMNS,
  MAX_ROWS,
  MAX_VALUES,
  defaultConfig,
  type AxisField,
  type AxisFieldSort,
  type BaseEntity,
  type ReportConfig,
  type ValueDef,
} from "@/lib/reports/types";
import { encodeConfig } from "@/lib/reports/url-state";
import { AiPromptDialog } from "./ai-prompt-dialog";
import { AxisChip } from "./axis-chip";
import { AddFieldButton } from "./axis-zone";
import { BaseEntityDropdown } from "./base-entity-dropdown";
import { FieldIcon } from "./field-icon";
import { InlineAxis } from "./inline-axis";
import { PivotEmptyState } from "./pivot-empty-state";
import { PivotTable } from "./pivot-table";
import { PropertyRail, type AxisName } from "./property-rail";

type Props = {
  initialConfig: ReportConfig;
};

const RAIL_WIDTH_KEY = "simplesat:reports:rail-width";

function isConfigEmpty(config: ReportConfig): boolean {
  return (
    config.rows.length === 0 &&
    config.columns.length === 0 &&
    config.filters.length === 0 &&
    config.values.length === 0
  );
}

export function ReportBuilder({ initialConfig }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<ReportConfig>(initialConfig);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [railWidth, setRailWidth] = useState<number>(256);
  const [activeDragField, setActiveDragField] = useState<PivotField | null>(
    null,
  );
  const [pendingBase, setPendingBase] = useState<BaseEntity | null>(null);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  // Workspace-scoped pivot registry (Bloom = curated + tier; others =
  // data-derived custom fields, no tier). `baseFields` is the current base's
  // list, reused for findField + descriptor conversion below.
  const pivotFields = usePivotFields();
  const baseFields = pivotFields[config.base];

  // Load persisted rail width
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RAIL_WIDTH_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setRailWidth(Number(saved));
    } catch {}
  }, []);

  // URL sync (replace, no scroll)
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("r", encodeConfig(config));
    router.replace(`?${next.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Run the report when config changes (debounced).
  useEffect(() => {
    const ready =
      config.values.length > 0 &&
      (config.rows.length > 0 || config.columns.length > 0);
    const timer = setTimeout(() => {
      startTransition(async () => {
        const r = ready ? await runReportAction(config) : null;
        setResult(r);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [config]);

  // ---- field add / update / remove ----

  const addField = useCallback(
    (field: PivotField, axis: AxisName) => {
      setConfig((prev) => {
        if (axis === "values") {
          if (prev.values.length >= MAX_VALUES) return prev;
          if (prev.values.some((v) => v.propertyId === field.id)) return prev;
          const agg = field.aggregations.includes("avg")
            ? "avg"
            : field.aggregations[0];
          return {
            ...prev,
            values: [...prev.values, { propertyId: field.id, agg }],
          };
        }
        // Rows / Columns require non-valueOnly fields.
        if (field.valueOnly) return prev;
        if (axis === "rows") {
          if (prev.rows.length >= MAX_ROWS) return prev;
          if (prev.rows.some((r) => r.propertyId === field.id)) return prev;
          if (prev.columns.some((c) => c.propertyId === field.id)) return prev;
          const next: AxisField = { propertyId: field.id };
          if (field.bucketable) next.bucket = "month";
          return { ...prev, rows: [...prev.rows, next] };
        }
        if (axis === "columns") {
          if (prev.columns.length >= MAX_COLUMNS) return prev;
          if (prev.columns.some((c) => c.propertyId === field.id)) return prev;
          if (prev.rows.some((r) => r.propertyId === field.id)) return prev;
          const next: AxisField = { propertyId: field.id };
          if (field.bucketable) next.bucket = "month";
          return { ...prev, columns: [...prev.columns, next] };
        }
        return prev;
      });
    },
    [],
  );

  const addCount = () => {
    setConfig((prev) => {
      if (prev.values.length >= MAX_VALUES) return prev;
      if (prev.values.some((v) => v.propertyId === "*")) return prev;
      return {
        ...prev,
        values: [...prev.values, { propertyId: "*", agg: "count" }],
      };
    });
  };

  const addFilter = useCallback((filter: Filter) => {
    setConfig((prev) => ({ ...prev, filters: [...prev.filters, filter] }));
  }, []);

  const setFilters = useCallback((next: Filter[]) => {
    setConfig((prev) => ({ ...prev, filters: next }));
  }, []);

  const updateAxis = (
    section: "rows" | "columns",
    index: number,
    next: AxisField,
  ) => {
    setConfig((prev) => {
      const arr = [...prev[section]];
      arr[index] = next;
      return { ...prev, [section]: arr };
    });
  };

  const updateValue = (index: number, next: ValueDef) => {
    setConfig((prev) => {
      const arr = [...prev.values];
      arr[index] = next;
      return { ...prev, values: arr };
    });
  };

  const removeAxis = (section: "rows" | "columns", index: number) => {
    setConfig((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));
  };

  const removeValue = (index: number) => {
    setConfig((prev) => {
      // Drop any axis sort that referenced the removed value, and shift down
      // indexes that point past it so they keep referring to the same chip.
      const scrubAxis = (axes: AxisField[]): AxisField[] =>
        axes.map((axis) => {
          const sort = axis.sort;
          if (!sort || sort.by !== "value") return axis;
          if (sort.valueIndex === index) {
            const next = { ...axis };
            delete next.sort;
            return next;
          }
          if (sort.valueIndex > index) {
            return {
              ...axis,
              sort: { ...sort, valueIndex: sort.valueIndex - 1 },
            };
          }
          return axis;
        });
      return {
        ...prev,
        values: prev.values.filter((_, i) => i !== index),
        rows: scrubAxis(prev.rows),
        columns: scrubAxis(prev.columns),
      };
    });
  };

  const reset = () => setConfig(defaultConfig(config.base));

  // ---- base change with Dialog confirmation ----

  const changeBase = useCallback(
    (next: BaseEntity) => {
      if (next === config.base) return;
      const hasFields =
        config.rows.length > 0 ||
        config.columns.length > 0 ||
        config.filters.length > 0 ||
        config.values.length > 0;
      if (!hasFields) {
        setConfig(defaultConfig(next));
        return;
      }
      setPendingBase(next);
    },
    [config],
  );

  const confirmBaseChange = () => {
    if (pendingBase) setConfig(defaultConfig(pendingBase));
    setPendingBase(null);
  };

  // ---- dnd ----

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const onDragStart = (event: DragStartEvent) => {
    const fieldId = event.active.data.current?.fieldId as string | undefined;
    if (!fieldId) return;
    const field = findField(baseFields, fieldId);
    if (field) setActiveDragField(field);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDragField(null);
    const overAxis = event.over?.data.current?.axis as AxisName | undefined;
    const fieldId = event.active.data.current?.fieldId as string | undefined;
    if (!overAxis || !fieldId) return;
    const field = findField(baseFields, fieldId);
    if (!field) return;
    if (overAxis === "filters") {
      addFilter({ propertyId: field.id, op: "notnull" });
      return;
    }
    addField(field, overAxis);
  };

  const onDragCancel = () => setActiveDragField(null);

  // ---- rail resize ----

  const onRailResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = railWidth;
    const move = (ev: PointerEvent) => {
      const next = Math.max(180, Math.min(420, startW + (ev.clientX - startX)));
      setRailWidth(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(RAIL_WIDTH_KEY, String(railWidthRef.current));
      } catch {}
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const railWidthRef = useRef(railWidth);
  useEffect(() => {
    railWidthRef.current = railWidth;
  }, [railWidth]);

  // ---- derived ----

  const rowFieldIds = config.rows.map((r) => r.propertyId);
  const columnFieldIds = config.columns.map((c) => c.propertyId);
  const valueFieldIds = config.values
    .map((v) => v.propertyId)
    .filter((id) => id !== "*");
  const canReset = !isConfigEmpty(config);

  const setAxisSort = (
    section: "rows" | "columns",
    next: AxisFieldSort | undefined,
  ) => {
    setConfig((prev) => {
      const arr = [...prev[section]];
      if (!arr[0]) return prev;
      const updated = { ...arr[0] };
      if (next) updated.sort = next;
      else delete updated.sort;
      arr[0] = updated;
      return { ...prev, [section]: arr };
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex flex-1 min-h-0">
        {/* Left rail */}
        <aside
          ref={railRef}
          style={{ width: railWidth }}
          className="relative shrink-0 border-r border-border bg-background overflow-y-auto"
        >
          <div className="flex flex-col gap-2 p-4">
            <div className="text-sm font-medium text-muted-foreground px-2">
              Properties
            </div>
            <PropertyRail base={config.base} onAddField={addField} />
          </div>
          <div
            onPointerDown={onRailResize}
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30"
          />
        </aside>

        {/* Main */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-2">
            <BaseEntityDropdown
              value={config.base}
              onChange={changeBase}
            />
            <div className="flex items-center gap-1">
              {pending && (
                <span className="text-sm text-muted-foreground mr-1">
                  refreshing…
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={!canReset}
                className="gap-1.5 cursor-pointer"
              >
                <RotateCcw size={14} />
                Reset
              </Button>
            </div>
          </div>

          {/* Inline axis row */}
          <div className="flex flex-wrap items-stretch gap-1 border-b border-border bg-muted/20 px-3 py-2">
            <InlineAxis
              id="rows"
              label="Rows"
              max={MAX_ROWS}
              current={config.rows.length}
              trigger={
                <AddFieldButton
                  base={config.base}
                  excluded={[...rowFieldIds, ...columnFieldIds]}
                  onAdd={(f) => addField(f, "rows")}
                />
              }
            >
              {config.rows.map((row, i) => {
                const field = findField(baseFields, row.propertyId);
                if (!field) return null;
                return (
                  <AxisChip
                    key={`${row.propertyId}-${i}`}
                    field={field}
                    axis={row}
                    axisName="rows"
                    onRemove={() => removeAxis("rows", i)}
                    onUpdate={(next) =>
                      updateAxis("rows", i, next as AxisField)
                    }
                  />
                );
              })}
            </InlineAxis>

            <div className="self-stretch w-px bg-border" />

            <InlineAxis
              id="columns"
              label="Columns"
              max={MAX_COLUMNS}
              current={config.columns.length}
              trigger={
                <AddFieldButton
                  base={config.base}
                  excluded={[...rowFieldIds, ...columnFieldIds]}
                  onAdd={(f) => addField(f, "columns")}
                />
              }
            >
              {config.columns.map((col, i) => {
                const field = findField(baseFields, col.propertyId);
                if (!field) return null;
                return (
                  <AxisChip
                    key={`${col.propertyId}-${i}`}
                    field={field}
                    axis={col}
                    axisName="columns"
                    onRemove={() => removeAxis("columns", i)}
                    onUpdate={(next) =>
                      updateAxis("columns", i, next as AxisField)
                    }
                  />
                );
              })}
            </InlineAxis>

            <div className="self-stretch w-px bg-border" />

            <InlineAxis
              id="values"
              label="Values"
              max={MAX_VALUES}
              current={config.values.length}
              trigger={
                <div className="flex items-center gap-1">
                  {!config.values.some((v) => v.propertyId === "*") && (
                    <button
                      type="button"
                      onClick={addCount}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer h-8"
                    >
                      Count
                    </button>
                  )}
                  <AddFieldButton
                    base={config.base}
                    excluded={valueFieldIds}
                    onAdd={(f) => addField(f, "values")}
                    allowValueOnly
                  />
                </div>
              }
            >
              {config.values.map((v, i) =>
                v.propertyId === "*" ? (
                  <AxisChip
                    key={`count-${i}`}
                    field="count"
                    axis={v}
                    axisName="values"
                    onRemove={() => removeValue(i)}
                    onUpdate={(next) => updateValue(i, next as ValueDef)}
                  />
                ) : (
                  (() => {
                    const field = findField(baseFields, v.propertyId);
                    if (!field) return null;
                    return (
                      <AxisChip
                        key={`${v.propertyId}-${i}`}
                        field={field}
                        axis={v}
                        axisName="values"
                        onRemove={() => removeValue(i)}
                        onUpdate={(next) => updateValue(i, next as ValueDef)}
                      />
                    );
                  })()
                ),
              )}
            </InlineAxis>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiPromptOpen(true)}
              className="ml-auto self-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={14} className="text-primary" />
              Build with AI
            </Button>
          </div>

          <AiPromptDialog
            open={aiPromptOpen}
            onOpenChange={setAiPromptOpen}
            initialPrompt=""
            base={config.base}
            onResult={(next) => setConfig(next)}
          />

          {/* Dedicated filter band — own visual weight, below the pivot strip */}
          <div className="flex items-stretch border-b border-border bg-muted/10 px-3 py-1.5">
            <FilterRow
              fields={pivotFieldsToDescriptors(baseFields)}
              filters={config.filters}
              onChange={setFilters}
              droppableId="filters"
              supportCombinator={false}
            />
          </div>

          <div className="p-6">
            {result ? (
              <PivotTable result={result} onSortChange={setAxisSort} />
            ) : (
              <PivotEmptyState
                hasBase={true}
                hasValues={config.values.length > 0}
              />
            )}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragField ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-primary bg-card pl-2 pr-3 py-1 text-sm shadow-lg cursor-grabbing">
            <FieldIcon
              dataType={activeDragField.dataType}
              className="text-muted-foreground"
            />
            <span className="text-foreground">{activeDragField.label}</span>
          </div>
        ) : null}
      </DragOverlay>

      <AlertDialog
        open={pendingBase != null}
        onOpenChange={(o) => {
          if (!o) setPendingBase(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch base entity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset the current report.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBaseChange}
              className="cursor-pointer"
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}
