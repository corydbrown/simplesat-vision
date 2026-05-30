import { describe, expect, it } from "vitest";
import {
  RESOLUTION_SCORECARD_V1,
  RESOLUTION_SCORECARD_V1_CRITERIA,
  RESOLUTION_SCORECARD_V1_NAME,
} from "./resolution-scorecard-v1";

describe("RESOLUTION_SCORECARD_V1 spec", () => {
  it("has exactly five categories — one per criterion in the v1 rubric", () => {
    expect(RESOLUTION_SCORECARD_V1.categories).toHaveLength(5);
  });

  it("targets the Resolution outcome (applies_to='resolution')", () => {
    expect(RESOLUTION_SCORECARD_V1.appliesTo).toBe("resolution");
  });

  it("is named 'Resolution Scorecard v1' so the installer's idempotency-by-name check works", () => {
    expect(RESOLUTION_SCORECARD_V1_NAME).toBe("Resolution Scorecard v1");
    expect(RESOLUTION_SCORECARD_V1.name).toBe(RESOLUTION_SCORECARD_V1_NAME);
  });

  it("uses likert_5 with no autofail category — Resolution grades customer outcome, not compliance", () => {
    expect(
      RESOLUTION_SCORECARD_V1.categories.every(
        (c) => c.scaleType === "likert_5",
      ),
    ).toBe(true);
    expect(
      RESOLUTION_SCORECARD_V1.categories.every((c) => c.isAutofail === false),
    ).toBe(true);
  });

  it("has criterion weights summing to 100", () => {
    const sum = RESOLUTION_SCORECARD_V1.categories
      .flatMap((c) => c.criteria)
      .reduce((acc, cr) => acc + cr.weightPercent, 0);
    expect(sum).toBe(100);
  });

  it("weights its five criteria equally (20% each) — no criterion grades more than another", () => {
    for (const category of RESOLUTION_SCORECARD_V1.categories) {
      for (const criterion of category.criteria) {
        expect(criterion.weightPercent).toBe(20);
      }
    }
  });

  it("renders every criterion's anchor texts (1/3/5) non-empty so the LLM prompt has anchor language to interpret", () => {
    for (const category of RESOLUTION_SCORECARD_V1.categories) {
      for (const criterion of category.criteria) {
        expect(criterion.anchor1.length).toBeGreaterThan(20);
        expect(criterion.anchor3.length).toBeGreaterThan(20);
        expect(criterion.anchor5.length).toBeGreaterThan(20);
      }
    }
  });

  it("exposes all five criterion category names as a stable lookup map", () => {
    const names = RESOLUTION_SCORECARD_V1.categories.map((c) => c.name);
    expect(names).toEqual(Object.values(RESOLUTION_SCORECARD_V1_CRITERIA));
  });

  it("Right routing criterion anchors name the wedge-exposure pattern — handoff timing, escalation, AI overreach", () => {
    // Right routing is the criterion that makes Resolution the wedge surface
    // it is — "this AI shouldn't have touched this" only gets scored here.
    // If the anchor language drifts away from handoff/escalation framing,
    // the rubric stops doing its strategic job. This test keeps the wedge
    // tethered to the spec the way ai-v2's nonCuriosity test keeps the
    // platform-question tells tethered there.
    const rightRouting = RESOLUTION_SCORECARD_V1.categories.find(
      (c) => c.name === RESOLUTION_SCORECARD_V1_CRITERIA.rightRouting,
    );
    expect(rightRouting).toBeDefined();
    const fail = rightRouting!.criteria[0].anchor1.toLowerCase();
    expect(fail).toMatch(/hand off|escalat/);
    const excellent = rightRouting!.criteria[0].anchor5.toLowerCase();
    expect(excellent).toMatch(/cleanly|promptly/);
  });

  it("bandDescriptors has exactly five entries (one per likert level)", () => {
    expect(RESOLUTION_SCORECARD_V1.bandDescriptors).toHaveLength(5);
    for (const band of RESOLUTION_SCORECARD_V1.bandDescriptors) {
      expect(band.length).toBeGreaterThan(20);
    }
  });
});
