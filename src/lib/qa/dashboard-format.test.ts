import { describe, expect, it } from "vitest";
import {
  csatDelta,
  deltaDirection,
  formatCsatAverage,
  formatRolledPercent,
  formatRolledScore,
  scoreDelta,
} from "./dashboard-format";

describe("formatRolledScore", () => {
  it("renders one decimal for a positive number", () => {
    expect(formatRolledScore(12.345)).toBe("12.3");
  });

  it("renders one decimal for zero", () => {
    expect(formatRolledScore(0)).toBe("0.0");
  });

  it("rounds via Number.toFixed (engine-dependent for tie-breaking)", () => {
    // toFixed's exact rounding mode is engine-defined for ties (4.95). Don't
    // assert on the tie; assert on a clear case so the regression anchor is
    // about *that we use toFixed*, not about which way ties go.
    expect(formatRolledScore(4.96)).toBe("5.0");
    expect(formatRolledScore(4.94)).toBe("4.9");
  });

  it("returns an em-dash for null", () => {
    expect(formatRolledScore(null)).toBe("—");
  });

  it("handles negatives", () => {
    expect(formatRolledScore(-1.23)).toBe("-1.2");
  });
});

describe("formatRolledPercent", () => {
  it("appends a % suffix with one decimal", () => {
    expect(formatRolledPercent(42.567)).toBe("42.6%");
  });

  it("returns an em-dash for null", () => {
    expect(formatRolledPercent(null)).toBe("—");
  });

  it("handles 100% cleanly", () => {
    expect(formatRolledPercent(100)).toBe("100.0%");
  });

  it("handles 0 cleanly", () => {
    expect(formatRolledPercent(0)).toBe("0.0%");
  });
});

describe("formatCsatAverage", () => {
  it("renders two decimals with the / 5 ceiling", () => {
    expect(formatCsatAverage(4.567)).toBe("4.57 / 5");
  });

  it("returns an em-dash for null", () => {
    expect(formatCsatAverage(null)).toBe("—");
  });

  it("handles a perfect 5", () => {
    expect(formatCsatAverage(5)).toBe("5.00 / 5");
  });
});

describe("deltaDirection", () => {
  it("classifies inside-threshold magnitude as neutral", () => {
    expect(deltaDirection(0.3, 0.5)).toBe("neutral");
    expect(deltaDirection(-0.3, 0.5)).toBe("neutral");
    expect(deltaDirection(0, 0.5)).toBe("neutral");
  });

  it("classifies positive delta past threshold as good", () => {
    expect(deltaDirection(0.6, 0.5)).toBe("good");
    expect(deltaDirection(10, 0.5)).toBe("good");
  });

  it("classifies negative delta past threshold as bad", () => {
    expect(deltaDirection(-0.6, 0.5)).toBe("bad");
    expect(deltaDirection(-10, 0.5)).toBe("bad");
  });

  it("treats exactly-at-threshold as inside the neutral band (strict <)", () => {
    // The implementation uses `Math.abs(delta) < neutralThreshold` — exactly
    // at the threshold is NOT inside neutral, it's good/bad. Encode that as
    // a regression anchor in case someone flips to <=.
    expect(deltaDirection(0.5, 0.5)).toBe("good");
    expect(deltaDirection(-0.5, 0.5)).toBe("bad");
  });
});

describe("scoreDelta", () => {
  it("returns undefined for null", () => {
    expect(scoreDelta(null)).toBeUndefined();
  });

  it("formats a positive delta with a + sign + good direction", () => {
    expect(scoreDelta(2.5)).toEqual({
      label: "+2.5",
      direction: "good",
      hint: "vs. prior 30 days",
    });
  });

  it("formats a negative delta with the native sign + bad direction", () => {
    expect(scoreDelta(-1.2)).toEqual({
      label: "-1.2",
      direction: "bad",
      hint: "vs. prior 30 days",
    });
  });

  it("treats a sub-0.5 magnitude as neutral", () => {
    expect(scoreDelta(0.3)?.direction).toBe("neutral");
    expect(scoreDelta(-0.3)?.direction).toBe("neutral");
  });

  it("treats zero delta as neutral with a +0.0 label", () => {
    expect(scoreDelta(0)).toEqual({
      label: "+0.0",
      direction: "neutral",
      hint: "vs. prior 30 days",
    });
  });
});

describe("csatDelta", () => {
  it("returns undefined for null", () => {
    expect(csatDelta(null)).toBeUndefined();
  });

  it("formats with two decimals and a ' stars' suffix", () => {
    expect(csatDelta(0.25)).toEqual({
      label: "+0.25 stars",
      direction: "good",
      hint: "vs. prior 30 days",
    });
  });

  it("uses a tighter neutral band than scoreDelta (0.05)", () => {
    // 0.03 stars is real movement on a 5-star scale; on a 100-point QA score
    // it would be noise. Different scales → different floors.
    expect(csatDelta(0.03)?.direction).toBe("neutral");
    expect(csatDelta(0.06)?.direction).toBe("good");
    expect(csatDelta(-0.06)?.direction).toBe("bad");
  });
});
