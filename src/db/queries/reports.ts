import "server-only";
import { db } from "@/db/client";
import { compileReport } from "@/lib/reports/compile";
import { buildPivot, type PivotCellKey } from "@/lib/reports/pivot";
import type { FieldDataType } from "@/lib/reports/pivot-fields";
import type { AxisFieldSort, ReportConfig, ValueDef } from "@/lib/reports/types";
import { requireWorkspace } from "@/lib/workspace";

export type ReportAxisMeta = {
  label: string;
  bucket?: string;
  dataType: FieldDataType;
};

/** Serializable shape sent to the client. */
export type ReportResult = {
  rowKeys: PivotCellKey[];
  columnKeys: PivotCellKey[];
  /** [rowKey][colKey] -> values[] */
  cells: Record<string, Record<string, number[]>>;
  rowTotals: Record<string, number[]>;
  columnTotals: Record<string, number[]>;
  grandTotals: number[];
  rowAxes: ReportAxisMeta[];
  columnAxes: ReportAxisMeta[];
  valueDefs: ValueDef[];
  rowSort?: AxisFieldSort;
  columnSort?: AxisFieldSort;
};

export async function runReport(
  config: ReportConfig,
): Promise<ReportResult | null> {
  const workspaceId = await requireWorkspace();
  const compiled = await compileReport(config, workspaceId);
  if (!compiled) return null;

  const rows = await db.all<Record<string, unknown>>(compiled.query);

  const rowSort = config.rows[0]?.sort;
  const columnSort = config.columns[0]?.sort;

  const grid = buildPivot(
    rows,
    compiled.rowAliases,
    compiled.columnAliases,
    compiled.valueAliases,
    compiled.valueDefs,
    { rowSort, columnSort },
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
      dataType: a.field.dataType,
    })),
    columnAxes: compiled.columnAliases.map((a) => ({
      label: a.field.label,
      bucket: a.bucket,
      dataType: a.field.dataType,
    })),
    valueDefs: compiled.valueDefs,
    rowSort,
    columnSort,
  };
}
