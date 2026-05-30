import { describe, expect, it } from "vitest";
import {
  isBullshit,
  type BullshitDetectorCategoryScore,
} from "./bullshit-detector";
import {
  AI_SCORECARD_V2_CRITERIA,
  BULLSHIT_DETECTOR_CRITERIA,
  BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW,
} from "./ai-scorecard-v2";

function score(
  name: string,
  effectiveScore: number,
): BullshitDetectorCategoryScore {
  return { categoryName: name, effectiveScore };
}

/** Helper: build a full set of category scores at a baseline, optionally
 *  overriding specific criteria. Default baseline of 5 keeps non-trigger
 *  criteria from accidentally affecting the result. */
function buildScores(
  overrides: Partial<Record<string, number>> = {},
  baseline = 5,
): BullshitDetectorCategoryScore[] {
  return Object.values(AI_SCORECARD_V2_CRITERIA).map((name) =>
    score(name, overrides[name] ?? baseline),
  );
}

describe("isBullshit", () => {
  it("trips when criteria 1+2+5 all score ≤ the fail threshold", () => {
    const scores = buildScores({
      [AI_SCORECARD_V2_CRITERIA.answerDirectness]: 1,
      [AI_SCORECARD_V2_CRITERIA.recognitionOfLimits]: 2,
      [AI_SCORECARD_V2_CRITERIA.customerTimeRespect]: 1,
    });
    expect(isBullshit(scores)).toBe(true);
  });

  it("does not trip when only 2 of the 3 trigger criteria fail (the manifesto's Mammoth Brands receipt)", () => {
    // Receipt #5: Non-curiosity + Accuracy fail, but Q1 was solid.
    // Bullshit Detector deliberately doesn't trip — feature, not bug.
    const scores = buildScores({
      [AI_SCORECARD_V2_CRITERIA.nonCuriosity]: 1,
      [AI_SCORECARD_V2_CRITERIA.accuracy]: 1,
      [AI_SCORECARD_V2_CRITERIA.customerTimeRespect]: 2,
    });
    expect(isBullshit(scores)).toBe(false);
  });

  it("does not trip when Non-curiosity fails — Non-curiosity is intentionally NOT in the trigger formula", () => {
    // Receipt #4 Chontelle compliance: Non-curiosity fails alone but the
    // canonical 1+2+5 pattern doesn't apply. Different failure shape.
    const scores = buildScores({
      [AI_SCORECARD_V2_CRITERIA.answerDirectness]: 1,
      [AI_SCORECARD_V2_CRITERIA.recognitionOfLimits]: 2,
      [AI_SCORECARD_V2_CRITERIA.customerTimeRespect]: 5, // ← passes time respect
      [AI_SCORECARD_V2_CRITERIA.nonCuriosity]: 1,
    });
    expect(isBullshit(scores)).toBe(false);
  });

  it("trips when all 3 trigger criteria are exactly at the threshold (boundary at 2)", () => {
    const scores = buildScores({
      [AI_SCORECARD_V2_CRITERIA.answerDirectness]:
        BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW,
      [AI_SCORECARD_V2_CRITERIA.recognitionOfLimits]:
        BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW,
      [AI_SCORECARD_V2_CRITERIA.customerTimeRespect]:
        BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW,
    });
    expect(isBullshit(scores)).toBe(true);
  });

  it("does not trip when any trigger criterion is one above the threshold (boundary at 3)", () => {
    const scores = buildScores({
      [AI_SCORECARD_V2_CRITERIA.answerDirectness]:
        BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW,
      [AI_SCORECARD_V2_CRITERIA.recognitionOfLimits]:
        BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW + 1,
      [AI_SCORECARD_V2_CRITERIA.customerTimeRespect]:
        BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW,
    });
    expect(isBullshit(scores)).toBe(false);
  });

  it("does not trip on a clean, high-scoring evaluation", () => {
    expect(isBullshit(buildScores({}, 5))).toBe(false);
    expect(isBullshit(buildScores({}, 4))).toBe(false);
    expect(isBullshit(buildScores({}, 3))).toBe(false);
  });

  it("returns false when category scores are missing for any trigger criterion", () => {
    // Evaluation against a different scorecard (e.g. IQS, Resolution v1)
    // won't have these named categories. Detector must not silently fire.
    expect(
      isBullshit([
        score(AI_SCORECARD_V2_CRITERIA.answerDirectness, 1),
        score(AI_SCORECARD_V2_CRITERIA.recognitionOfLimits, 1),
        // Missing Customer time respect.
      ]),
    ).toBe(false);
    expect(isBullshit([])).toBe(false);
  });

  it("ignores non-trigger criterion scores (Accuracy, No theater, Non-curiosity)", () => {
    // Trigger criteria all fail → trips, regardless of the other three.
    const allBadOthers = buildScores(
      {
        [AI_SCORECARD_V2_CRITERIA.answerDirectness]: 1,
        [AI_SCORECARD_V2_CRITERIA.recognitionOfLimits]: 1,
        [AI_SCORECARD_V2_CRITERIA.customerTimeRespect]: 1,
        [AI_SCORECARD_V2_CRITERIA.accuracy]: 1,
        [AI_SCORECARD_V2_CRITERIA.noTheater]: 1,
        [AI_SCORECARD_V2_CRITERIA.nonCuriosity]: 1,
      },
      5,
    );
    expect(isBullshit(allBadOthers)).toBe(true);

    const allGoodOthers = buildScores(
      {
        [AI_SCORECARD_V2_CRITERIA.answerDirectness]: 1,
        [AI_SCORECARD_V2_CRITERIA.recognitionOfLimits]: 1,
        [AI_SCORECARD_V2_CRITERIA.customerTimeRespect]: 1,
      },
      5,
    );
    expect(isBullshit(allGoodOthers)).toBe(true);
  });
});

describe("AI_SCORECARD_V2 contract", () => {
  it("references three criteria whose names match the scorecard's category names", () => {
    // The detector keys off category-name equality. If a category gets
    // renamed without updating BULLSHIT_DETECTOR_CRITERIA, the detector
    // would silently return false forever. This test makes that drift loud.
    const expected = [
      AI_SCORECARD_V2_CRITERIA.answerDirectness,
      AI_SCORECARD_V2_CRITERIA.recognitionOfLimits,
      AI_SCORECARD_V2_CRITERIA.customerTimeRespect,
    ];
    expect(BULLSHIT_DETECTOR_CRITERIA).toEqual(expected);
  });
});
