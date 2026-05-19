"use client";

import type { ReportResult } from "@/db/queries/reports";
import { formatPivotValue, valueLabel } from "@/lib/reports/format";
import { cn } from "@/lib/utils";

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

export function PivotTable({ result }: { result: ReportResult }) {
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
  } = result;

  const valueCount = valueDefs.length;
  const hasColumns = columnAxes.length > 0;
  const hasRows = rowAxes.length > 0;
  const hasMultipleRowAxes = rowAxes.length > 1;
  const showValueHeaderRow = hasColumns && valueCount > 1;
  const rowHeaderCols = Math.max(hasRows ? rowAxes.length : 0, 1);

  // For 2-row pivots, merge the first-axis label across consecutive rows
  // that share the same value (Notion / Excel rowspan behavior).
  const firstAxisSpans = hasMultipleRowAxes
    ? computeRowSpans(rowKeys.map((rk) => rk.labels[0] ?? ""))
    : null;

  return (
    <div className="relative max-h-[calc(100vh-220px)] overflow-x-auto overflow-y-auto rounded-md border border-border bg-card">
      <table className="w-auto min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-30">
          {hasColumns ? (
            <>
              {/* Row-axis header labels + column-axis labels */}
              <tr className="border-b border-border bg-muted/40">
                {Array.from({ length: rowHeaderCols }).map((_, i) => (
                  <th
                    key={`rh-${i}`}
                    className={cn(
                      "px-3 py-2 text-left text-xs font-medium text-muted-foreground bg-muted/40",
                      i === 0 && "sticky left-0 z-10",
                    )}
                  >
                    {rowAxes[i]?.label ?? ""}
                    {rowAxes[i]?.bucket ? (
                      <span className="ml-1 text-muted-foreground/70">
                        by {rowAxes[i].bucket}
                      </span>
                    ) : null}
                  </th>
                ))}
                {columnKeys.map((ck) => (
                  <th
                    key={ck.key}
                    colSpan={valueCount}
                    className="border-l border-border bg-muted/40 px-3 py-2 text-center text-xs font-medium text-foreground"
                  >
                    {ck.labels.join(" · ")}
                  </th>
                ))}
                <th
                  colSpan={valueCount}
                  className="border-l border-border bg-muted/40 px-3 py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  Total
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
                          "bg-muted/20 px-3 py-1.5 text-right text-xs text-muted-foreground",
                          vi === 0 && "border-l border-border",
                        )}
                      >
                        {valueLabel(v)}
                      </th>
                    )),
                  )}
                  {valueDefs.map((v, vi) => (
                    <th
                      key={`tot-${vi}`}
                      className={cn(
                        "bg-muted/20 px-3 py-1.5 text-right text-xs text-muted-foreground",
                        vi === 0 && "border-l border-border",
                      )}
                    >
                      {valueLabel(v)}
                    </th>
                  ))}
                </tr>
              )}
            </>
          ) : (
            <tr className="border-b border-border bg-muted/40">
              {Array.from({ length: rowHeaderCols }).map((_, i) => (
                <th
                  key={`rh-${i}`}
                  className={cn(
                    "bg-muted/40 px-3 py-2 text-left text-xs font-medium text-muted-foreground",
                    i === 0 && "sticky left-0 z-10",
                  )}
                >
                  {rowAxes[i]?.label ?? ""}
                  {rowAxes[i]?.bucket ? (
                    <span className="ml-1 text-muted-foreground/70">
                      by {rowAxes[i].bucket}
                    </span>
                  ) : null}
                </th>
              ))}
              {valueDefs.map((v, vi) => (
                <th
                  key={`v-${vi}`}
                  className={cn(
                    "bg-muted/40 px-3 py-2 text-right text-xs font-medium text-foreground",
                    vi === 0 && "border-l border-border",
                  )}
                >
                  {valueLabel(v)}
                </th>
              ))}
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
                className="px-3 py-8 text-center text-sm text-muted-foreground"
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
                      // First axis with rowSpan grouping
                      if (i === 0 && firstAxisSpans) {
                        if (firstSpan === 0) return null; // skipped: covered by rowSpan above
                        return (
                          <th
                            key={`${rk.key}-h-${i}`}
                            rowSpan={firstSpan}
                            className={cn(
                              "sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-medium text-foreground whitespace-nowrap align-top",
                              ri > 0 && "border-t border-border",
                            )}
                          >
                            {rk.labels[i] ?? ""}
                          </th>
                        );
                      }
                      return (
                        <th
                          key={`${rk.key}-h-${i}`}
                          className={cn(
                            "px-3 py-2 text-left text-sm font-normal text-foreground",
                            i === 0 && "sticky left-0 z-10 bg-card font-medium",
                          )}
                        >
                          {rk.labels[i] ?? ""}
                        </th>
                      );
                    })
                  ) : (
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm text-muted-foreground">
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
                              ? formatPivotValue(vals[vi], v.agg)
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
                          {formatPivotValue(totals[vi] ?? 0, v.agg)}
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
                        {formatPivotValue(totals[vi] ?? 0, v.agg)}
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
                className="sticky left-0 z-10 bg-accent/40 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
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
                        {formatPivotValue(vals[vi] ?? 0, v.agg)}
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
                  {formatPivotValue(grandTotals[vi] ?? 0, v.agg)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
