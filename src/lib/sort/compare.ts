import type { Property } from "@/lib/properties/types";
import type { SortSpec } from "./url-state";

type Primitive = string | number | Date | null | undefined;

function compareValues(a: Primitive, b: Primitive): number {
  // Nulls last in either direction; caller flips sign for desc.
  const aNull = a == null;
  const bNull = b == null;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : Number(a);
    const bt = b instanceof Date ? b.getTime() : Number(b);
    return at === bt ? 0 : at < bt ? -1 : 1;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

export function applyMultiSort<T>(
  rows: T[],
  sorts: SortSpec[],
  properties: Property<T>[],
): T[] {
  if (sorts.length === 0) return rows;

  const propsById = new Map(properties.map((p) => [p.id, p]));
  const accessors: { fn: (row: T) => Primitive; sign: number }[] = [];
  for (const s of sorts) {
    const p = propsById.get(s.key);
    if (!p?.sortValue) continue;
    accessors.push({
      fn: p.sortValue as (row: T) => Primitive,
      sign: s.dir === "asc" ? 1 : -1,
    });
  }
  if (accessors.length === 0) return rows;

  // Stable: tag with original index, then compare.
  const tagged = rows.map((row, i) => ({ row, i }));
  tagged.sort((a, b) => {
    for (const { fn, sign } of accessors) {
      const cmp = compareValues(fn(a.row), fn(b.row));
      if (cmp !== 0) return cmp * sign;
    }
    return a.i - b.i;
  });
  return tagged.map((t) => t.row);
}
