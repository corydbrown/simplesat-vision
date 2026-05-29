import type { ScorecardScaleType } from "@/db/schema";

/** The single binary Pass threshold. Binary scores are only ever 0 | 1, so
 *  `>= 1` and `=== 1` are equivalent today — but centralizing the comparison
 *  kills the copy-pasted `>=1` vs `===1` drift that let one ticket read
 *  Pass on one surface and Fail on another, and gives three_state / future
 *  scales one authoritative place to define their boundary. */
export const BINARY_PASS_THRESHOLD = 1;

/** Max raw score per scale — the `N` in `"score / N"`. */
const SCALE_DENOMINATOR: Record<ScorecardScaleType, number> = {
  binary: 1,
  three_state: 2,
  likert_5: 5,
};

/** Whether a binary (0 | 1) score is a Pass. */
export function isBinaryPass(score: number): boolean {
  return score >= BINARY_PASS_THRESHOLD;
}

/** Format a raw category / criterion score for display.
 *  - `binary` → `"Pass"` | `"Fail"`
 *  - `three_state` → `"score / 2"`
 *  - `likert_5` → `"score / 5"` */
export function formatScore(score: number, scale: ScorecardScaleType): string {
  if (scale === "binary") return isBinaryPass(score) ? "Pass" : "Fail";
  return `${score} / ${SCALE_DENOMINATOR[scale]}`;
}
