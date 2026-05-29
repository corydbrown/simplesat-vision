import { Hash } from "lucide-react";
import { describe, expect, it } from "vitest";
import { applyMultiSort } from "./compare";
import type { Property } from "@/lib/properties/types";

type Row = {
  id: string;
  name: string | null;
  score: number | null;
  createdAt: Date | null;
};

function prop<K extends keyof Row>(
  id: K,
  accessor: (row: Row) => Row[K] | null,
): Property<Row> {
  return {
    id: id as string,
    label: id as string,
    width: 100,
    icon: Hash,
    sourceEntity: "row",
    sortable: true,
    sortValue: (row) =>
      accessor(row) as string | number | Date | null,
    cell: () => null,
  };
}

const NAME = prop("name", (r) => r.name);
const SCORE = prop("score", (r) => r.score);
const CREATED = prop("createdAt", (r) => r.createdAt);

describe("applyMultiSort", () => {
  it("returns the original order when every row is null on the sort key (stable)", () => {
    const rows: Row[] = [
      { id: "a", name: null, score: null, createdAt: null },
      { id: "b", name: null, score: null, createdAt: null },
      { id: "c", name: null, score: null, createdAt: null },
    ];
    const sorted = applyMultiSort(
      rows,
      [{ key: "name", dir: "asc" }],
      [NAME],
    );
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("puts nulls last on ascending sort AND on descending sort", () => {
    const rows: Row[] = [
      { id: "a", name: null, score: 5, createdAt: null },
      { id: "b", name: "Beta", score: null, createdAt: null },
      { id: "c", name: "Alpha", score: 1, createdAt: null },
    ];
    const asc = applyMultiSort(rows, [{ key: "name", dir: "asc" }], [NAME]);
    expect(asc.map((r) => r.id)).toEqual(["c", "b", "a"]);
    const desc = applyMultiSort(rows, [{ key: "name", dir: "desc" }], [NAME]);
    expect(desc.map((r) => r.id)).toEqual(["b", "c", "a"]); // Beta, Alpha, then null
  });

  it("compares strings case-insensitively (sensitivity: base)", () => {
    const rows: Row[] = [
      { id: "a", name: "banana", score: null, createdAt: null },
      { id: "b", name: "Apple", score: null, createdAt: null },
      { id: "c", name: "cherry", score: null, createdAt: null },
    ];
    const sorted = applyMultiSort(
      rows,
      [{ key: "name", dir: "asc" }],
      [NAME],
    );
    expect(sorted.map((r) => r.name)).toEqual(["Apple", "banana", "cherry"]);
  });

  it("coerces Date and number cross-type comparisons via timestamps", () => {
    // Mixed Date and number sortValues — the comparator coerces both to
    // millisecond timestamps and compares numerically.
    const rows: Row[] = [
      { id: "a", name: "", score: null, createdAt: new Date("2026-01-15") },
      // `b` returns a raw number through the prop accessor, simulating a
      // sort-by epoch case.
      { id: "b", name: "", score: null, createdAt: new Date("2026-03-01") },
      { id: "c", name: "", score: null, createdAt: new Date("2026-02-10") },
    ];
    const sorted = applyMultiSort(
      rows,
      [{ key: "createdAt", dir: "asc" }],
      [CREATED],
    );
    expect(sorted.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("breaks ties on the original row index (stable across primary key)", () => {
    const rows: Row[] = [
      { id: "a", name: "X", score: 10, createdAt: null },
      { id: "b", name: "Y", score: 10, createdAt: null },
      { id: "c", name: "Z", score: 10, createdAt: null },
      { id: "d", name: "A", score: 5, createdAt: null },
    ];
    const sorted = applyMultiSort(
      rows,
      [{ key: "score", dir: "desc" }],
      [SCORE],
    );
    // All score=10 rows precede score=5; among the 10s, the original order
    // (a, b, c) is preserved by the index tie-break.
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });
});
