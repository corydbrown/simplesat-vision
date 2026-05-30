import {
  AI_SCORECARD_V2_NAME,
  BULLSHIT_DETECTOR_CRITERIA,
  BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW,
} from "./ai-scorecard-v2";

export {
  BULLSHIT_DETECTOR_CRITERIA,
  BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW,
} from "./ai-scorecard-v2";

/** Shape of a single category score on an evaluation, narrowed to the fields
 *  the Bullshit Detector reads. Effective score = human override if present,
 *  else AI score (mirrors `evaluation_category_scores.effective_score`). */
export type BullshitDetectorCategoryScore = {
  categoryName: string;
  effectiveScore: number;
};

/** The Bullshit Detector trips when criteria 1 (Answer directness),
 *  2 (Recognition of limits), AND 5 (Customer time respect) ALL score
 *  ≤ {@link BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW} on the same evaluation
 *  against the v2 AI scorecard.
 *
 *  This is the "trying-trying-trying" pattern named in the manifesto: the
 *  AI faking competence with trained voice while the customer's actual
 *  problem remains unsolved. Per the manifesto's Receipt #5 (Mammoth
 *  Brands), the detector deliberately does NOT include Non-curiosity in
 *  the trigger formula — a multi-part ticket where the bot screwed up one
 *  part should not be flagged as wholesale bullshit. That's a feature.
 *
 *  Returns `false` for an evaluation that does not have category scores
 *  for all three required criteria — the detector only fires against the
 *  v2 scorecard. */
export function isBullshit(
  categoryScores: readonly BullshitDetectorCategoryScore[],
): boolean {
  const byName = new Map(
    categoryScores.map((s) => [s.categoryName, s.effectiveScore]),
  );
  for (const criterionName of BULLSHIT_DETECTOR_CRITERIA) {
    const score = byName.get(criterionName);
    if (score == null) return false;
    if (score > BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW) return false;
  }
  return true;
}

/** The name of the v2 scorecard the detector is keyed to. Re-exported so
 *  callers don't have to know about ai-scorecard-v2 to filter evaluations. */
export const BULLSHIT_DETECTOR_SCORECARD_NAME = AI_SCORECARD_V2_NAME;
