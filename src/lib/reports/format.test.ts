import { describe, expect, it } from "vitest";
import { formatPivotValue } from "./format";

describe("formatPivotValue", () => {
  describe("currency-cents", () => {
    it("zero → $0.00", () => {
      expect(formatPivotValue(0, "sum", "currency-cents")).toBe("$0.00");
    });

    it("1234 cents → $12.34", () => {
      expect(formatPivotValue(1234, "sum", "currency-cents")).toBe("$12.34");
    });

    it("12345 cents → $123.45", () => {
      expect(formatPivotValue(12345, "sum", "currency-cents")).toBe("$123.45");
    });

    it("12 cents → $0.12", () => {
      expect(formatPivotValue(12, "sum", "currency-cents")).toBe("$0.12");
    });

    it("100 cents → $1.00", () => {
      expect(formatPivotValue(100, "sum", "currency-cents")).toBe("$1.00");
    });

    it("sub-cent value rounds to nearest cent", () => {
      // 0.5 cents → $0.005 → rounds to $0.01 (banker's/half-even or half-up;
      // Intl uses half-even by default — 0.5 is exact at the half boundary
      // so this can go either way depending on platform. Just assert it's
      // $0.00 or $0.01 — either is acceptable rounding behavior.)
      const out = formatPivotValue(0.5, "sum", "currency-cents");
      expect(["$0.00", "$0.01"]).toContain(out);
    });

    it("negative cents → -$2.50", () => {
      expect(formatPivotValue(-250, "sum", "currency-cents")).toBe("-$2.50");
    });

    it("large value formats with thousands separator", () => {
      // 1,234,567 cents → $12,345.67
      expect(formatPivotValue(1234567, "sum", "currency-cents")).toBe(
        "$12,345.67",
      );
    });

    it("formatType wins over agg=avg (currency, not decimal)", () => {
      expect(formatPivotValue(1234, "avg", "currency-cents")).toBe("$12.34");
    });
  });

  describe("non-finite values → · regardless of formatType", () => {
    it("NaN", () => {
      expect(formatPivotValue(Number.NaN, "sum", "currency-cents")).toBe("·");
      expect(formatPivotValue(Number.NaN, "avg")).toBe("·");
      expect(formatPivotValue(Number.NaN, "sum")).toBe("·");
    });

    it("Infinity", () => {
      expect(formatPivotValue(Infinity, "sum", "currency-cents")).toBe("·");
      expect(formatPivotValue(-Infinity, "sum")).toBe("·");
    });
  });

  describe("formatType=int forces integer formatting", () => {
    it("overrides avg's default decimal", () => {
      expect(formatPivotValue(3.7, "avg", "int")).toBe("4");
    });

    it("formats thousands separator", () => {
      expect(formatPivotValue(1234567, "sum", "int")).toBe("1,234,567");
    });
  });

  describe("formatType=decimal forces decimal formatting", () => {
    it("overrides sum's default integer", () => {
      expect(formatPivotValue(3.5, "sum", "decimal")).toBe("3.5");
    });

    it("integers get one decimal place", () => {
      expect(formatPivotValue(42, "sum", "decimal")).toBe("42.0");
    });
  });

  describe("undefined formatType falls back to agg-based default", () => {
    it("avg → decimal", () => {
      expect(formatPivotValue(3.456, "avg")).toBe("3.46");
    });

    it("sum → int", () => {
      expect(formatPivotValue(1234.56, "sum")).toBe("1,235");
    });

    it("count → int", () => {
      expect(formatPivotValue(42, "count")).toBe("42");
    });

    it("min/max → int", () => {
      expect(formatPivotValue(7.9, "min")).toBe("8");
      expect(formatPivotValue(7.9, "max")).toBe("8");
    });
  });
});
