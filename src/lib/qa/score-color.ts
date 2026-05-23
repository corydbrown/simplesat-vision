/**
 * Shared QA score color + bucket helpers. Both the Tickets list column (SVP-55)
 * and the per-ticket QA section (SVP-54) consume this — whichever PR lands first
 * defines the file; the second rebases onto it.
 *
 * Score buckets reflect the PRD review workflow: "needs review" is the dominant
 * mental model, so the palette emphasises the bottom of the scale. Auto-failed
 * is a distinct bucket from `poor` because the auto-fail floor (default 30) is
 * a hard rule violation, not a low score on the rubric — surfacing it lets QA
 * managers triage compliance separately from coaching.
 */

import type { QaEvaluationStatus } from "@/db/schema";

export const QA_SCORE_BUCKETS = [
  "excellent",
  "good",
  "needs-attention",
  "poor",
  "auto-failed",
  "not-scored",
] as const;

export type QaScoreBucket = (typeof QA_SCORE_BUCKETS)[number];

/** PRD default auto-fail floor — when any binary auto-fail criterion fails the
 *  overall score is clamped to this value. Mirrored here so the bucket helper
 *  does not need to thread the scorecard through. If a future scorecard ships
 *  with a different floor, this constant becomes a per-scorecard lookup. */
export const QA_AUTO_FAIL_FLOOR = 30;

export function qaScoreBucket(
  score: number | null | undefined,
  status?: QaEvaluationStatus | null,
): QaScoreBucket {
  if (score == null) return "not-scored";
  if (status === "invalidated") return "not-scored";
  if (score <= QA_AUTO_FAIL_FLOOR) return "auto-failed";
  if (score < 60) return "poor";
  if (score < 75) return "needs-attention";
  if (score < 90) return "good";
  return "excellent";
}

export const QA_BUCKET_LABEL: Record<QaScoreBucket, string> = {
  excellent: "Excellent",
  good: "Good",
  "needs-attention": "Needs attention",
  poor: "Poor",
  "auto-failed": "Auto-failed",
  "not-scored": "Not scored",
};

/** Tailwind class triplet for badges that render the score: background, text,
 *  border. Maps to production hue tokens (see DESIGN.md → "Production hue
 *  palette") so the column theme-flips correctly. Avoid raw Tailwind hues. */
export const QA_BUCKET_CLASSES: Record<
  QaScoreBucket,
  { bg: string; text: string; border: string }
> = {
  excellent: {
    bg: "bg-green-lighter",
    text: "text-green-darker",
    border: "border-green-light",
  },
  good: {
    bg: "bg-blue-lighter",
    text: "text-blue-darker",
    border: "border-blue-light",
  },
  "needs-attention": {
    bg: "bg-yellow-lighter",
    text: "text-yellow-darker",
    border: "border-yellow-light",
  },
  poor: {
    bg: "bg-red-lighter",
    text: "text-red-darker",
    border: "border-red-light",
  },
  "auto-failed": {
    bg: "bg-red-dark",
    text: "text-white",
    border: "border-red-darker",
  },
  "not-scored": {
    bg: "bg-grey-lighter",
    text: "text-muted-foreground",
    border: "border-grey-light",
  },
};
