import "server-only";
import { db } from "@/db/client";
import { compileReport } from "@/lib/reports/compile";
import { buildPivot, type PivotCellKey } from "@/lib/reports/pivot";
import type { ReportConfig, ValueDef } from "@/lib/reports/types";

/** Serializable shape sent to the client. */
export type ReportResult = {
  rowKeys: PivotCellKey[];
  columnKeys: PivotCellKey[];
  /** [rowKey][colKey] -> values[] */
  cells: Record<string, Record<string, number[]>>;
  rowTotals: Record<string, number[]>;
  columnTotals: Record<string, number[]>;
  grandTotals: number[];
  rowAxes: Array<{ label: string; bucket?: string }>;
  columnAxes: Array<{ label: string; bucket?: string }>;
  valueDefs: ValueDef[];
};

export async function runReport(
  config: ReportConfig,
): Promise<ReportResult | null> {
  const compiled = compileReport(config);
  if (!compiled) return null;

  const rows = await db.all<Record<string, unknown>>(compiled.query);

  const grid = buildPivot(
    rows,
    compiled.rowAliases,
    compiled.columnAliases,
    compiled.valueAliases,
    compiled.valueDefs,
  );

  const cells: Record<string, Record<string, number[]>> = {};
  for (const [rk, byCol] of grid.cells) {
    cells[rk] = Object.fromEntries(byCol);
  }
  const rowTotals = Object.fromEntries(grid.rowTotals);
  const columnTotals = Object.fromEntries(grid.columnTotals);

  return {
    rowKeys: grid.rowKeys,
    columnKeys: grid.columnKeys,
    cells,
    rowTotals,
    columnTotals,
    grandTotals: grid.grandTotals,
    rowAxes: compiled.rowAliases.map((a) => ({
      label: a.field.label,
      bucket: a.bucket,
    })),
    columnAxes: compiled.columnAliases.map((a) => ({
      label: a.field.label,
      bucket: a.bucket,
    })),
    valueDefs: compiled.valueDefs,
  };
}
