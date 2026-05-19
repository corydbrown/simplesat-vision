import type { Aggregation, ValueDef } from "./types";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export function formatPivotValue(value: number, agg: Aggregation): string {
  if (!Number.isFinite(value)) return "·";
  if (agg === "avg") return decFmt.format(value);
  return intFmt.format(value);
}

export function valueLabel(v: ValueDef, fieldLabel?: string): string {
  if (v.label) return v.label;
  if (v.propertyId === "*" || v.agg === "count") {
    return v.propertyId === "*" ? "Count" : `Count of ${fieldLabel ?? v.propertyId}`;
  }
  const aggLabel: Record<Aggregation, string> = {
    count: "Count",
    sum: "Sum",
    avg: "Avg",
    min: "Min",
    max: "Max",
  };
  return `${aggLabel[v.agg]} ${fieldLabel ?? v.propertyId}`.toLowerCase().replace(/^./, (c) => c.toUpperCase());
}
