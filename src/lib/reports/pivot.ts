import type { AxisAlias } from "./compile";
import type { ValueDef } from "./types";

export type PivotCellKey = {
  key: string;
  labels: string[];
};

export type PivotGrid = {
  rowKeys: PivotCellKey[];
  columnKeys: PivotCellKey[];
  /** cells[rowKey][colKey] -> per-value numeric array */
  cells: Map<string, Map<string, number[]>>;
  rowTotals: Map<string, number[]>;
  columnTotals: Map<string, number[]>;
  grandTotals: number[];
};

const NULL_LABEL = "(none)";

function coordKey(parts: (string | number | null | undefined)[]): string {
  return parts.map((p) => (p == null ? "∅" : String(p))).join("¦");
}

function coordLabels(
  parts: (string | number | null | undefined)[],
): string[] {
  return parts.map((p) => (p == null || p === "" ? NULL_LABEL : String(p)));
}

function readAxis(
  row: Record<string, unknown>,
  alias: AxisAlias,
): { value: unknown; label: string | null } {
  const value = row[alias.alias];
  const labelRaw = alias.labelAlias ? row[alias.labelAlias] : value;
  const label =
    labelRaw == null || labelRaw === ""
      ? null
      : typeof labelRaw === "number"
        ? String(labelRaw)
        : String(labelRaw);
  return { value, label };
}

export function buildPivot(
  rows: Array<Record<string, unknown>>,
  rowAliases: AxisAlias[],
  columnAliases: AxisAlias[],
  valueAliases: string[],
  values: ValueDef[],
): PivotGrid {
  const rowKeysMap = new Map<string, PivotCellKey>();
  const colKeysMap = new Map<string, PivotCellKey>();
  const cells = new Map<string, Map<string, number[]>>();

  // For totals across rows / columns / grand, we keep per-value accumulators
  // plus a separate "count of cells contributing" used only for avg roll-up.
  type Acc = {
    values: number[];
    counts: number[]; // how many source values contributed to each index
    mins: number[];
    maxs: number[];
  };
  const newAcc = (): Acc => ({
    values: Array(valueAliases.length).fill(0),
    counts: Array(valueAliases.length).fill(0),
    mins: Array(valueAliases.length).fill(Number.POSITIVE_INFINITY),
    maxs: Array(valueAliases.length).fill(Number.NEGATIVE_INFINITY),
  });

  const rowAcc = new Map<string, Acc>();
  const colAcc = new Map<string, Acc>();
  const grandAcc = newAcc();

  const SINGLETON = "∅all";

  for (const row of rows) {
    // Build row key
    const rowParts = rowAliases.map((a) => readAxis(row, a));
    const rowKey =
      rowAliases.length === 0
        ? SINGLETON
        : coordKey(rowParts.map((p) => (p.value as string | number | null)));
    const rowLabels =
      rowAliases.length === 0
        ? []
        : coordLabels(rowParts.map((p) => p.label));
    if (!rowKeysMap.has(rowKey))
      rowKeysMap.set(rowKey, { key: rowKey, labels: rowLabels });

    // Build column key
    const colParts = columnAliases.map((a) => readAxis(row, a));
    const colKey =
      columnAliases.length === 0
        ? SINGLETON
        : coordKey(colParts.map((p) => (p.value as string | number | null)));
    const colLabels =
      columnAliases.length === 0
        ? []
        : coordLabels(colParts.map((p) => p.label));
    if (!colKeysMap.has(colKey))
      colKeysMap.set(colKey, { key: colKey, labels: colLabels });

    // Read value numbers
    const nums = valueAliases.map((v) => {
      const raw = row[v];
      if (raw == null) return 0;
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? n : 0;
    });

    // Set cell (each (row, col) pair appears at most once from a GROUP BY).
    let byCol = cells.get(rowKey);
    if (!byCol) {
      byCol = new Map();
      cells.set(rowKey, byCol);
    }
    byCol.set(colKey, nums);

    // Accumulate totals
    const accumulate = (acc: Acc) => {
      for (let i = 0; i < nums.length; i++) {
        acc.values[i] += nums[i];
        acc.counts[i] += 1;
        if (nums[i] < acc.mins[i]) acc.mins[i] = nums[i];
        if (nums[i] > acc.maxs[i]) acc.maxs[i] = nums[i];
      }
    };
    let rAcc = rowAcc.get(rowKey);
    if (!rAcc) {
      rAcc = newAcc();
      rowAcc.set(rowKey, rAcc);
    }
    accumulate(rAcc);
    let cAcc = colAcc.get(colKey);
    if (!cAcc) {
      cAcc = newAcc();
      colAcc.set(colKey, cAcc);
    }
    accumulate(cAcc);
    accumulate(grandAcc);
  }

  const rollUp = (acc: Acc): number[] =>
    values.map((v, i) => {
      if (acc.counts[i] === 0) return 0;
      switch (v.agg) {
        case "count":
        case "sum":
          return acc.values[i];
        case "avg":
          return acc.values[i] / acc.counts[i];
        case "min":
          return acc.mins[i];
        case "max":
          return acc.maxs[i];
      }
    });

  const rowTotals = new Map<string, number[]>();
  for (const [k, a] of rowAcc) rowTotals.set(k, rollUp(a));
  const columnTotals = new Map<string, number[]>();
  for (const [k, a] of colAcc) columnTotals.set(k, rollUp(a));

  return {
    rowKeys: Array.from(rowKeysMap.values()),
    columnKeys: Array.from(colKeysMap.values()),
    cells,
    rowTotals,
    columnTotals,
    grandTotals: rollUp(grandAcc),
  };
}
