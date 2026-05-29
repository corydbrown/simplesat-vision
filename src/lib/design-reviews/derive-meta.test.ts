import { describe, expect, it } from "vitest";
import { firstSentence, toReviewMeta } from "./derive-meta";
import type { DesignReview, DesignReviewHeader } from "./types";

const review: DesignReview = {
  generatedFor: "test",
  dimensions: [
    {
      dimension: "Typography ladder",
      severity: "medium",
      summary: "summary a",
      approxTotalCount: 32,
      findings: [],
      systemicRecommendation: "rec a",
    },
    {
      dimension: "Raw hue classes",
      severity: "low",
      summary: "summary b",
      approxTotalCount: 0,
      findings: [],
      systemicRecommendation: "rec b",
    },
  ],
  synthesis: {
    executiveSummary:
      "Overall health is B. A second sentence that should not appear.",
    overallHealth: "B",
    healthGrade: "B",
    crossCuttingThemes: [],
    topRecommendations: [],
    suggestedRemediationTasks: [],
  },
};

const header: DesignReviewHeader = {
  slug: "2026-05-29-review-1",
  date: "2026-05-29",
  reviewNumber: 1,
  title: "Review #1",
  method: "design-drift-audit",
};

describe("firstSentence", () => {
  it("returns text up to the first terminator", () => {
    expect(firstSentence("Hello there. More text.")).toBe("Hello there.");
  });

  it("handles text with no terminator", () => {
    expect(firstSentence("No terminator here")).toBe("No terminator here");
  });

  it("does not split on a decimal inside a number", () => {
    expect(firstSentence("Health is 9.5 out of 10. Next.")).toBe(
      "Health is 9.5 out of 10.",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(firstSentence("  spaced. ")).toBe("spaced.");
  });
});

describe("toReviewMeta", () => {
  it("maps each dimension to name/severity/count in order", () => {
    const meta = toReviewMeta(review, header);
    expect(meta.dimensions).toEqual([
      { name: "Typography ladder", severity: "medium", count: 32 },
      { name: "Raw hue classes", severity: "low", count: 0 },
    ]);
  });

  it("copies through header + grade fields", () => {
    const meta = toReviewMeta(review, header);
    expect(meta.slug).toBe("2026-05-29-review-1");
    expect(meta.reviewNumber).toBe(1);
    expect(meta.healthGrade).toBe("B");
    expect(meta.method).toBe("design-drift-audit");
  });

  it("falls back to the executive summary's first sentence", () => {
    const meta = toReviewMeta(review, header);
    expect(meta.summary).toBe("Overall health is B.");
  });

  it("prefers an authored summary over the fallback", () => {
    const meta = toReviewMeta(review, { ...header, summary: "Authored line" });
    expect(meta.summary).toBe("Authored line");
  });

  it("treats a blank authored summary as absent", () => {
    const meta = toReviewMeta(review, { ...header, summary: "   " });
    expect(meta.summary).toBe("Overall health is B.");
  });
});
