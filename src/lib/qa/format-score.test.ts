import { describe, expect, it } from "vitest";
import {
  BINARY_PASS_THRESHOLD,
  formatScore,
  isBinaryPass,
} from "./format-score";

describe("isBinaryPass", () => {
  it("treats 1 as Pass and 0 as Fail", () => {
    expect(isBinaryPass(1)).toBe(true);
    expect(isBinaryPass(0)).toBe(false);
  });

  it("uses a single threshold so `>= 1` and `=== 1` can't diverge", () => {
    // Binary values are only ever 0 | 1, but the threshold is `>=` so any
    // future positive value still reads as Pass — one rule, no copy-paste drift.
    expect(isBinaryPass(BINARY_PASS_THRESHOLD)).toBe(true);
    expect(isBinaryPass(BINARY_PASS_THRESHOLD - 1)).toBe(false);
    expect(isBinaryPass(2)).toBe(true);
  });
});

describe("formatScore", () => {
  it("renders binary as Pass / Fail", () => {
    expect(formatScore(1, "binary")).toBe("Pass");
    expect(formatScore(0, "binary")).toBe("Fail");
  });

  it("renders three_state as score / 2", () => {
    expect(formatScore(0, "three_state")).toBe("0 / 2");
    expect(formatScore(1, "three_state")).toBe("1 / 2");
    expect(formatScore(2, "three_state")).toBe("2 / 2");
  });

  it("renders likert_5 as score / 5", () => {
    expect(formatScore(1, "likert_5")).toBe("1 / 5");
    expect(formatScore(5, "likert_5")).toBe("5 / 5");
  });
});
