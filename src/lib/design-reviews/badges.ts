import type { Priority, Severity } from "./types";

/** Production-hue className maps for the review badges. Every value uses the
 *  themeable `-lighter`/`-darker` token scale (never a raw Tailwind hue, never
 *  the non-existent `-default` shade — that absent shade was Review #1's P1
 *  bug). Pure lookups so the gallery and detail page stay in sync.
 *
 *  Hue budget: the palette has no `orange`, so the four-step severity scale
 *  rides green → yellow → red, with `critical` inverting the red pill for the
 *  loudest possible read.
 */

const SEVERITY_CLASS: Record<Severity, string> = {
  low: "bg-green-lighter text-green-darker",
  medium: "bg-yellow-lighter text-yellow-darker",
  high: "bg-red-lighter text-red-darker",
  critical: "bg-red-darker text-red-lighter",
};

const PRIORITY_CLASS: Record<Priority, string> = {
  P1: "bg-red-lighter text-red-darker",
  P2: "bg-yellow-lighter text-yellow-darker",
  P3: "bg-blue-lighter text-blue-darker",
};

/** Effort is neutral metadata, not a severity signal — one grey tone for every
 *  size, so it's a constant rather than a per-value map. */
export const EFFORT_BADGE_CLASS = "bg-grey-lighter text-grey-darker";

export function severityClass(severity: Severity): string {
  return SEVERITY_CLASS[severity];
}

export function priorityClass(priority: Priority): string {
  return PRIORITY_CLASS[priority];
}

/** Severity rank for sorting/ordering dimensions worst-first. */
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function severityRank(severity: Severity): number {
  return SEVERITY_RANK[severity];
}
