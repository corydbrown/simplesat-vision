import { describe, expect, it } from "vitest";
import {
  AI_SCORECARD_V2,
  AI_SCORECARD_V2_CRITERIA,
  AI_SCORECARD_V2_NAME,
} from "./ai-scorecard-v2";

describe("AI_SCORECARD_V2 spec", () => {
  it("has exactly six categories — one per criterion in the v2 rubric", () => {
    expect(AI_SCORECARD_V2.categories).toHaveLength(6);
  });

  it("targets the AI actor (applies_to='ai')", () => {
    expect(AI_SCORECARD_V2.appliesTo).toBe("ai");
  });

  it("is named 'AI Scorecard v2' so it installs alongside Phase 2b's 'AI Quality (Internal)' without collision", () => {
    expect(AI_SCORECARD_V2_NAME).toBe("AI Scorecard v2");
    expect(AI_SCORECARD_V2.name).toBe(AI_SCORECARD_V2_NAME);
  });

  it("uses likert_5 with no autofail category — the Bullshit Detector is the headline floor, not an autofail floor", () => {
    expect(AI_SCORECARD_V2.categories.every((c) => c.scaleType === "likert_5"))
      .toBe(true);
    expect(AI_SCORECARD_V2.categories.every((c) => c.isAutofail === false))
      .toBe(true);
  });

  it("has criterion weights summing to 100", () => {
    const sum = AI_SCORECARD_V2.categories
      .flatMap((c) => c.criteria)
      .reduce((acc, cr) => acc + cr.weightPercent, 0);
    expect(sum).toBe(100);
  });

  it("renders every criterion's anchor texts (1/3/5) non-empty so the LLM prompt has anchor language to interpret", () => {
    for (const category of AI_SCORECARD_V2.categories) {
      for (const criterion of category.criteria) {
        expect(criterion.anchor1.length).toBeGreaterThan(20);
        expect(criterion.anchor3.length).toBeGreaterThan(20);
        expect(criterion.anchor5.length).toBeGreaterThan(20);
      }
    }
  });

  it("exposes all six criterion category names as a stable lookup map", () => {
    const names = AI_SCORECARD_V2.categories.map((c) => c.name);
    expect(names).toEqual(Object.values(AI_SCORECARD_V2_CRITERIA));
  });

  it("Non-curiosity criterion anchors mention the manifesto's tells (platform assumption, why-question)", () => {
    // The Non-curiosity criterion is new in v2 and the calibration depends
    // on the manifesto's receipts. Keep the anchor language tethered to
    // those signals so prompt rendering carries the rubric's intent.
    const nonCuriosity = AI_SCORECARD_V2.categories.find(
      (c) => c.name === AI_SCORECARD_V2_CRITERIA.nonCuriosity,
    );
    expect(nonCuriosity).toBeDefined();
    const fail = nonCuriosity!.criteria[0].anchor1.toLowerCase();
    expect(fail).toMatch(/platform/);
    const excellent = nonCuriosity!.criteria[0].anchor5.toLowerCase();
    expect(excellent).toMatch(/underlying|why/);
  });
});
