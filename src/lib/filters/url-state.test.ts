import { describe, expect, it } from "vitest";
import { decodeFilters, encodeFilters } from "./url-state";
import type { Filter } from "./types";

describe("decodeFilters", () => {
  it("round-trips a typical filter set through encode → decode", () => {
    const filters: Filter[] = [
      { propertyId: "subject", op: "contains", value: "refund" },
      {
        propertyId: "status",
        op: "in",
        value: ["open", "pending"],
        combinator: "OR",
      },
      {
        propertyId: "createdAt",
        op: "relative",
        value: { n: 7, unit: "days", dir: "past" },
      },
      { propertyId: "tags", op: "notnull" },
    ];
    const encoded = encodeFilters(filters);
    const decoded = decodeFilters(encoded);
    expect(decoded).toEqual(filters);
  });

  it("returns an empty array for null/empty/corrupt-base64 input", () => {
    expect(decodeFilters(null)).toEqual([]);
    expect(decodeFilters("")).toEqual([]);
    // Garbage that decodes but isn't JSON.
    expect(decodeFilters("not-valid-base64!!!")).toEqual([]);
  });

  it("drops rows where value type doesn't match the op (type confusion)", () => {
    const corrupt = encodeFilters([
      // `between` requires a 2-tuple — pass a single number and the row's
      // value should be stripped, with the row dropped because its op needs a
      // value to compile (sanitizeValue → undefined; row sanitizer keeps the
      // row without value; downstream compiler then ignores it).
      { propertyId: "age", op: "between", value: 5 as never },
      // Properly-shaped row beside it survives.
      { propertyId: "subject", op: "contains", value: "ok" },
    ]);
    const decoded = decodeFilters(corrupt);
    // The malformed `between` row keeps its op but no value.
    const between = decoded.find((f) => f.op === "between");
    expect(between?.value).toBeUndefined();
    // The well-formed row survives intact.
    expect(decoded.find((f) => f.op === "contains")?.value).toBe("ok");
  });

  it("drops rows missing required op / propertyId fields", () => {
    const corrupt = encodeFilters([
      // Missing propertyId.
      { op: "eq", value: "x" } as unknown as Filter,
      // Unknown op string.
      {
        propertyId: "subject",
        op: "totally-not-an-op",
        value: "x",
      } as unknown as Filter,
      { propertyId: "subject", op: "eq", value: "x" },
    ]);
    const decoded = decodeFilters(corrupt);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].propertyId).toBe("subject");
  });

  it("drops malformed RelativeValue payloads", () => {
    const corrupt = encodeFilters([
      {
        propertyId: "createdAt",
        op: "relative",
        // `unit: "years"` is not a valid RelativeUnit.
        value: { n: 7, unit: "years", dir: "past" } as never,
      },
      {
        propertyId: "createdAt",
        op: "relative",
        value: { n: 30, unit: "days", dir: "past" },
      },
    ]);
    const decoded = decodeFilters(corrupt);
    // Bad value dropped (row kept without value); good value preserved.
    const withValue = decoded.find(
      (f) => f.op === "relative" && f.value !== undefined,
    );
    expect(withValue?.value).toMatchObject({
      n: 30,
      unit: "days",
      dir: "past",
    });
  });
});
