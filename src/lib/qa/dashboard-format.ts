import type { StatCardDelta } from "@/components/shared/stat-card";

/**
 * Dashboard-level formatters for rolled-up QA metrics. These operate on
 * averages / percentages / period-deltas, NOT raw per-eval scores — those
 * live in `format-score.ts` and are scale-aware.
 *
 * Pure: same input → same output. Null-tolerant; renders an em-dash for
 * missing data so callers don't have to branch.
 */

/** Format a rolled-up score (e.g. average overall_score 0–5 or 0–100) to one
 *  decimal. `null` renders as an em-dash. */
export function formatRolledScore(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

/** Format a rolled-up percentage (e.g. pass-rate) to one decimal with a `%`
 *  suffix. `null` renders as an em-dash. */
export function formatRolledPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

/** Format a CSAT average against the canonical 5-star ceiling. Two decimals
 *  to preserve sensitivity at the top of the scale where movement matters
 *  most. `null` renders as an em-dash. */
export function formatCsatAverage(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)} / 5`;
}

/** Classify a period-over-period delta into a StatCardDelta direction.
 *  Deltas within `±neutralThreshold` are "neutral" so we don't paint
 *  microscopic noise as a trend. */
export function deltaDirection(
  delta: number,
  neutralThreshold: number,
): StatCardDelta["direction"] {
  if (Math.abs(delta) < neutralThreshold) return "neutral";
  return delta > 0 ? "good" : "bad";
}

/** Build the StatCardDelta footer for a score (0–100 / 0–5 range). Calibrated
 *  for percentage-point movement at the tile-card scale: 0.5 is the noise
 *  floor below which we don't bother painting a direction. */
export function scoreDelta(
  delta: number | null,
): StatCardDelta | undefined {
  if (delta == null) return undefined;
  const sign = delta >= 0 ? "+" : "";
  return {
    label: `${sign}${delta.toFixed(1)}`,
    direction: deltaDirection(delta, 0.5),
    hint: "vs. prior 30 days",
  };
}

/** Build the StatCardDelta footer for a CSAT average (0–5 stars). Lower
 *  noise floor (0.05) than scoreDelta because the scale is tighter — a
 *  0.1-star shift on CSAT is meaningful, where a 0.1-point shift on a
 *  100-point QA score isn't. */
export function csatDelta(
  delta: number | null,
): StatCardDelta | undefined {
  if (delta == null) return undefined;
  const sign = delta >= 0 ? "+" : "";
  return {
    label: `${sign}${delta.toFixed(2)} stars`,
    direction: deltaDirection(delta, 0.05),
    hint: "vs. prior 30 days",
  };
}
