"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReportAxisMeta, ReportResult } from "@/db/queries/reports";
import { formatPivotValue, valueLabel } from "@/lib/reports/format";
import type { EntityRef } from "@/lib/reports/pivot";
import type { AxisFieldSort, SortDirection } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import {
  CustomerPill,
  SurveyPill,
  TeamMemberPill,
} from "@/components/shared/entity-pill";

function EntityCell({ entity, label }: { entity: EntityRef; label: string }) {
  switch (entity.entity) {
    case "customer":
      return <CustomerPill id={entity.id} name={label} />;
    case "team-member":
      return <TeamMemberPill id={entity.id} name={label} />;
    case "survey":
      return <SurveyPill id={entity.id} name={label} />;
    // ticket and response have no relation-field axes in the current pivot
    // registry, so we fall back to plain text. If those are added, render
    // the matching pill here.
    case "ticket":
    case "response":
      return <>{label}</>;
  }
}

type SortTarget =
  | { kind: "axis-field" }
  | { kind: "value"; valueIndex: number };

type OnSortChange = (
  axis: "rows" | "columns",
  next: AxisFieldSort | undefined,
) => void;

type PivotTableProps = {
  result: ReportResult;
  onSortChange?: OnSortChange;
};

function computeRowSpans(labels: string[]): number[] {
  const spans = new Array(labels.length).fill(0);
  let i = 0;
  while (i < labels.length) {
    let j = i + 1;
    while (j < labels.length && labels[j] === labels[i]) j++;
    spans[i] = j - i;
    i = j;
  }
  return spans;
}

function firstDirectionForAxis(axis: ReportAxisMeta | undefined): SortDirection {
  // Numeric axes start desc on first click; everything else starts asc.
  return axis?.dataType === "number" ? "desc" : "asc";
}

function targetMatches(
  sort: AxisFieldSort | undefined,
  target: SortTarget,
): boolean {
  if (!sort) return false;
  if (target.kind === "axis-field") return sort.by === "field";
  return sort.by === "value" && sort.valueIndex === target.valueIndex;
}

function nextSort(
  current: AxisFieldSort | undefined,
  target: SortTarget,
  firstDirection: SortDirection,
): AxisFieldSort | undefined {
  const opposite: SortDirection = firstDirection === "asc" ? "desc" : "asc";

  // Different target — start fresh in firstDirection.
  if (!targetMatches(current, target)) {
    if (target.kind === "axis-field") {
      return { by: "field", direction: firstDirection };
    }
    return { by: "value", valueIndex: target.valueIndex, direction: firstDirection };
  }

  // Same target, already at firstDirection — flip.
  if (current!.direction === firstDirection) {
    if (target.kind === "axis-field") {
      return { by: "field", direction: opposite };
    }
    return { by: "value", valueIndex: target.valueIndex, direction: opposite };
  }

  // Same target, at the opposite direction — clear.
  return undefined;
}

function activeDirection(
  sort: AxisFieldSort | undefined,
  target: SortTarget,
): SortDirection | null {
  if (!targetMatches(sort, target)) return null;
  return sort!.direction;
}

function SortIconButton({
  active,
  direction,
  onClick,
  className,
}: {
  active: boolean;
  direction: SortDirection | null;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Sort"
      className={cn(
        "group inline-flex items-center justify-center rounded-sm p-0.5 hover:bg-muted cursor-pointer",
        className,
      )}
    >
      {active && direction === "desc" ? (
        <ArrowDown size={12} className="text-foreground shrink-0" aria-hidden />
      ) : active && direction === "asc" ? (
        <ArrowUp size={12} className="text-foreground shrink-0" aria-hidden />
      ) : (
        <ChevronsUpDown
          size={12}
          className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/70"
          aria-hidden
        />
      )}
    </button>
  );
}

function SortableHeader({
  children,
  active,
  direction,
  onClick,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  active: boolean;
  direction: SortDirection | null;
  onClick: () => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex w-full items-center gap-1 rounded-sm px-0.5 py-0.5 hover:bg-muted cursor-pointer",
        align === "right" && "justify-end",
        align === "center" && "justify-center",
        align === "left" && "justify-start",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {active && direction === "desc" ? (
        <ArrowDown size={12} className="text-foreground shrink-0" aria-hidden />
      ) : active && direction === "asc" ? (
        <ArrowUp size={12} className="text-foreground shrink-0" aria-hidden />
      ) : (
        <ChevronsUpDown
          size={12}
          className="shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/70"
          aria-hidden
        />
      )}
    </button>
  );
}

export function PivotTable({ result, onSortChange }: PivotTableProps) {
  const {
    rowKeys,
    columnKeys,
    cells,
    rowTotals,
    columnTotals,
    grandTotals,
    rowAxes,
    columnAxes,
    valueDefs,
    valueFormatTypes,
    rowSort,
    columnSort,
  } = result;

  const valueCount = valueDefs.length;
  const hasColumns = columnAxes.length > 0;
  const hasRows = rowAxes.length > 0;
  const hasMultipleRowAxes = rowAxes.length > 1;
  const showValueHeaderRow = hasColumns && valueCount > 1;
  const rowHeaderCols = Math.max(hasRows ? rowAxes.length : 0, 1);

  const firstAxisSpans = hasMultipleRowAxes
    ? computeRowSpans(rowKeys.map((rk) => rk.labels[0] ?? ""))
    : null;

  const rowAxisFirstDir = firstDirectionForAxis(rowAxes[0]);
  const columnAxisFirstDir = firstDirectionForAxis(columnAxes[0]);

  const onClickRowAxis = () => {
    if (!onSortChange || !hasRows) return;
    onSortChange(
      "rows",
      nextSort(rowSort, { kind: "axis-field" }, rowAxisFirstDir),
    );
  };

  const onClickColumnAxis = () => {
    if (!onSortChange || !hasColumns) return;
    onSortChange(
      "columns",
      nextSort(columnSort, { kind: "axis-field" }, columnAxisFirstDir),
    );
  };

  const onClickValue = (valueIndex: number) => {
    if (!onSortChange || !hasRows) return;
    onSortChange(
      "rows",
      nextSort(rowSort, { kind: "value", valueIndex }, "desc"),
    );
  };

  const rowAxisFieldDir = activeDirection(rowSort, { kind: "axis-field" });
  const columnAxisFieldDir = activeDirection(columnSort, {
    kind: "axis-field",
  });

  return (
    <div className="relative max-h-[calc(100vh-220px)] overflow-x-auto overflow-y-auto rounded-md border border-border bg-card">
      <table className="w-auto min-w-full border-collapse text-base">
        <thead className="sticky top-0 z-30">
          {hasColumns ? (
            <>
              <tr className="border-b border-border bg-muted/40">
                {Array.from({ length: rowHeaderCols }).map((_, i) => (
                  <th
                    key={`rh-${i}`}
                    className={cn(
                      "px-3 py-2 text-left text-base font-medium text-muted-foreground bg-muted/40",
                      i === 0 && "sticky left-0 z-10",
                    )}
                  >
                    {i === 0 && hasRows ? (
                      <SortableHeader
                        active={rowAxisFieldDir != null}
                        direction={rowAxisFieldDir}
                        onClick={onClickRowAxis}
                      >
                        {rowAxes[i]?.label ?? ""}
                        {rowAxes[i]?.bucket ? (
                          <span className="ml-1 text-muted-foreground/70">
                            by {rowAxes[i].bucket}
                          </span>
                        ) : null}
                      </SortableHeader>
                    ) : (
                      <>
                        {rowAxes[i]?.label ?? ""}
                        {rowAxes[i]?.bucket ? (
                          <span className="ml-1 text-muted-foreground/70">
                            by {rowAxes[i].bucket}
                          </span>
                        ) : null}
                      </>
                    )}
                  </th>
                ))}
                {columnKeys.map((ck) => {
                  const hasEntity = ck.entities.some((e) => e != null);
                  return (
                    <th
                      key={ck.key}
                      colSpan={valueCount}
                      className="border-l border-border bg-muted/40 px-3 py-2 text-center text-base font-medium text-foreground"
                    >
                      {hasEntity ? (
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {ck.labels.map((lbl, li) => {
                            const e = ck.entities[li];
                            return (
                              <span
                                key={li}
                                className="inline-flex items-center"
                              >
                                {li > 0 && (
                                  <span className="mr-1.5 text-muted-foreground/60">
                                    ·
                                  </span>
                                )}
                                {e ? (
                                  <EntityCell entity={e} label={lbl} />
                                ) : (
                                  <span>{lbl}</span>
                                )}
                              </span>
                            );
                          })}
                          <SortIconButton
                            active={columnAxisFieldDir != null}
                            direction={columnAxisFieldDir}
                            onClick={onClickColumnAxis}
                          />
                        </div>
                      ) : (
                        <SortableHeader
                          active={columnAxisFieldDir != null}
                          direction={columnAxisFieldDir}
                          onClick={onClickColumnAxis}
                          align="center"
                        >
                          {ck.labels.join(" · ")}
                        </SortableHeader>
                      )}
                    </th>
                  );
                })}
                <th
                  colSpan={valueCount}
                  className="border-l border-border bg-muted/40 px-3 py-2 text-center text-base font-medium text-muted-foreground"
                >
                  {!showValueHeaderRow && valueCount === 1 ? (
                    (() => {
                      const dir = activeDirection(rowSort, {
                        kind: "value",
                        valueIndex: 0,
                      });
                      return (
                        <SortableHeader
                          active={dir != null}
                          direction={dir}
                          onClick={() => onClickValue(0)}
                          align="center"
                        >
                          {valueLabel(valueDefs[0])}
                        </SortableHeader>
                      );
                    })()
                  ) : (
                    "Total"
                  )}
                </th>
              </tr>
              {showValueHeaderRow && (
                <tr className="border-b border-border bg-muted/20">
                  {Array.from({ length: rowHeaderCols }).map((_, i) => (
                    <th
                      key={`rh2-${i}`}
                      className={cn(
                        "px-3 py-1.5 bg-muted/20",
                        i === 0 && "sticky left-0 z-10",
                      )}
                    />
                  ))}
                  {columnKeys.map((ck) =>
                    valueDefs.map((v, vi) => (
                      <th
                        key={`${ck.key}-${vi}`}
                        className={cn(
                          "bg-muted/20 px-3 py-1.5 text-right text-base text-muted-foreground",
                          vi === 0 && "border-l border-border",
                        )}
                      >
                        {valueLabel(v)}
                      </th>
                    )),
                  )}
                  {valueDefs.map((v, vi) => {
                    const dir = activeDirection(rowSort, {
                      kind: "value",
                      valueIndex: vi,
                    });
                    return (
                      <th
                        key={`tot-${vi}`}
                        className={cn(
                          "bg-muted/20 px-3 py-1.5 text-right text-base text-muted-foreground",
                          vi === 0 && "border-l border-border",
                        )}
                      >
                        <SortableHeader
                          active={dir != null}
                          direction={dir}
                          onClick={() => onClickValue(vi)}
                          align="right"
                        >
                          {valueLabel(v)}
                        </SortableHeader>
                      </th>
                    );
                  })}
                </tr>
              )}
            </>
          ) : (
            <tr className="border-b border-border bg-muted/40">
              {Array.from({ length: rowHeaderCols }).map((_, i) => (
                <th
                  key={`rh-${i}`}
                  className={cn(
                    "bg-muted/40 px-3 py-2 text-left text-base font-medium text-muted-foreground",
                    i === 0 && "sticky left-0 z-10",
                  )}
                >
                  {i === 0 && hasRows ? (
                    <SortableHeader
                      active={rowAxisFieldDir != null}
                      direction={rowAxisFieldDir}
                      onClick={onClickRowAxis}
                    >
                      {rowAxes[i]?.label ?? ""}
                      {rowAxes[i]?.bucket ? (
                        <span className="ml-1 text-muted-foreground/70">
                          by {rowAxes[i].bucket}
                        </span>
                      ) : null}
                    </SortableHeader>
                  ) : (
                    <>
                      {rowAxes[i]?.label ?? ""}
                      {rowAxes[i]?.bucket ? (
                        <span className="ml-1 text-muted-foreground/70">
                          by {rowAxes[i].bucket}
                        </span>
                      ) : null}
                    </>
                  )}
                </th>
              ))}
              {valueDefs.map((v, vi) => {
                const dir = activeDirection(rowSort, {
                  kind: "value",
                  valueIndex: vi,
                });
                return (
                  <th
                    key={`v-${vi}`}
                    className={cn(
                      "bg-muted/40 px-3 py-2 text-right text-base font-medium text-foreground",
                      vi === 0 && "border-l border-border",
                    )}
                  >
                    <SortableHeader
                      active={dir != null}
                      direction={dir}
                      onClick={() => onClickValue(vi)}
                      align="right"
                    >
                      {valueLabel(v)}
                    </SortableHeader>
                  </th>
                );
              })}
            </tr>
          )}
        </thead>

        <tbody>
          {rowKeys.length === 0 ? (
            <tr>
              <td
                colSpan={
                  rowHeaderCols +
                  (hasColumns
                    ? columnKeys.length * valueCount + valueCount
                    : valueCount)
                }
                className="px-3 py-8 text-center text-base text-muted-foreground"
              >
                No results.
              </td>
            </tr>
          ) : (
            rowKeys.map((rk, ri) => {
              const cellsByCol = cells[rk.key] ?? {};
              const totals = rowTotals[rk.key] ?? [];
              const firstSpan = firstAxisSpans?.[ri];
              const isGroupStart = !firstAxisSpans || firstSpan! > 0;
              return (
                <tr
                  key={rk.key}
                  className={cn(
                    "border-b border-border last:border-0",
                    firstAxisSpans && !isGroupStart && "border-t-0",
                  )}
                >
                  {hasRows ? (
                    rowAxes.map((_, i) => {
                      const label = rk.labels[i] ?? "";
                      const entity = rk.entities[i] ?? null;
                      const content = entity ? (
                        <EntityCell entity={entity} label={label} />
                      ) : (
                        label
                      );
                      if (i === 0 && firstAxisSpans) {
                        if (firstSpan === 0) return null;
                        return (
                          <th
                            key={`${rk.key}-h-${i}`}
                            rowSpan={firstSpan}
                            className={cn(
                              "sticky left-0 z-10 bg-card px-3 py-2 text-left text-base font-medium text-foreground whitespace-nowrap align-top",
                              ri > 0 && "border-t border-border",
                            )}
                          >
                            {content}
                          </th>
                        );
                      }
                      return (
                        <th
                          key={`${rk.key}-h-${i}`}
                          className={cn(
                            "px-3 py-2 text-left text-base font-normal text-foreground",
                            i === 0 && "sticky left-0 z-10 bg-card font-medium",
                          )}
                        >
                          {content}
                        </th>
                      );
                    })
                  ) : (
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-base text-muted-foreground">
                      Total
                    </th>
                  )}

                  {hasColumns
                    ? columnKeys.flatMap((ck) => {
                        const vals = cellsByCol[ck.key];
                        return valueDefs.map((v, vi) => (
                          <td
                            key={`${rk.key}-${ck.key}-${vi}`}
                            className={cn(
                              "px-3 py-2 text-right tabular-nums",
                              vi === 0 && "border-l border-border",
                              vals?.[vi] == null && "text-muted-foreground/50",
                            )}
                          >
                            {vals && vals[vi] != null
                              ? formatPivotValue(vals[vi], v.agg, valueFormatTypes[vi])
                              : "·"}
                          </td>
                        ));
                      })
                    : valueDefs.map((v, vi) => (
                        <td
                          key={`${rk.key}-only-${vi}`}
                          className={cn(
                            "px-3 py-2 text-right tabular-nums",
                            vi === 0 && "border-l border-border",
                          )}
                        >
                          {formatPivotValue(totals[vi] ?? 0, v.agg, valueFormatTypes[vi])}
                        </td>
                      ))}

                  {hasColumns &&
                    valueDefs.map((v, vi) => (
                      <td
                        key={`${rk.key}-tot-${vi}`}
                        className={cn(
                          "px-3 py-2 text-right tabular-nums font-medium bg-muted/20",
                          vi === 0 && "border-l border-border",
                        )}
                      >
                        {formatPivotValue(totals[vi] ?? 0, v.agg, valueFormatTypes[vi])}
                      </td>
                    ))}
                </tr>
              );
            })
          )}
        </tbody>

        {rowKeys.length > 0 && (
          <tfoot className="sticky bottom-0 z-20">
            <tr className="border-t border-border bg-accent/40">
              <th
                colSpan={rowHeaderCols}
                className="sticky left-0 z-10 bg-accent/40 px-3 py-2 text-left text-base font-medium text-muted-foreground"
              >
                Total
              </th>
              {hasColumns
                ? columnKeys.flatMap((ck) => {
                    const vals = columnTotals[ck.key] ?? [];
                    return valueDefs.map((v, vi) => (
                      <td
                        key={`tot-${ck.key}-${vi}`}
                        className={cn(
                          "bg-accent/40 px-3 py-2 text-right tabular-nums font-medium",
                          vi === 0 && "border-l border-border",
                        )}
                      >
                        {formatPivotValue(vals[vi] ?? 0, v.agg, valueFormatTypes[vi])}
                      </td>
                    ));
                  })
                : null}
              {valueDefs.map((v, vi) => (
                <td
                  key={`grand-${vi}`}
                  className={cn(
                    "bg-accent/40 px-3 py-2 text-right tabular-nums font-medium",
                    vi === 0 && "border-l border-border",
                    hasColumns && "bg-accent/60",
                  )}
                >
                  {formatPivotValue(grandTotals[vi] ?? 0, v.agg, valueFormatTypes[vi])}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
