import { describe, expect, it } from "vitest";
import { qaScoreBucket, QA_AUTO_FAIL_FLOOR } from "./score-color";

describe("qaScoreBucket", () => {
  it("returns 'not-scored' for null/undefined score", () => {
    expect(qaScoreBucket(null)).toBe("not-scored");
    expect(qaScoreBucket(undefined)).toBe("not-scored");
  });

  it("returns 'not-scored' when the evaluation is invalidated, regardless of score", () => {
    expect(qaScoreBucket(95, "invalidated")).toBe("not-scored");
    expect(qaScoreBucket(10, "invalidated")).toBe("not-scored");
  });

  it("applies the auto-fail floor: scores at or below the floor bucket as 'auto-failed'", () => {
    expect(qaScoreBucket(QA_AUTO_FAIL_FLOOR)).toBe("auto-failed");
    expect(qaScoreBucket(QA_AUTO_FAIL_FLOOR - 1)).toBe("auto-failed");
    // The first non-autofail-floor value bumps into 'poor'.
    expect(qaScoreBucket(QA_AUTO_FAIL_FLOOR + 1)).toBe("poor");
  });

  it("applies the exclusive < cutoffs at 60, 75, 90", () => {
    expect(qaScoreBucket(59)).toBe("poor");
    expect(qaScoreBucket(60)).toBe("needs-attention");
    expect(qaScoreBucket(74)).toBe("needs-attention");
    expect(qaScoreBucket(75)).toBe("good");
    expect(qaScoreBucket(89)).toBe("good");
    expect(qaScoreBucket(90)).toBe("excellent");
  });

  it("does not clamp — out-of-band scores fall into the natural extremes", () => {
    // No clamp by design (callers project before they get here); the buckets
    // still degrade cleanly: very-high → excellent, very-low → auto-failed.
    expect(qaScoreBucket(200)).toBe("excellent");
    expect(qaScoreBucket(-5)).toBe("auto-failed");
  });
});
