/** Design-review registry. The gallery at `/design` reads `DESIGN_REVIEWS` and
 *  renders one card per review; `/design/[slug]` resolves a review via
 *  `getReviewBySlug`.
 *
 *  Adding a review: create a file in `./entries/<date>-review-<n>.ts` exporting
 *  an `entry: DesignReviewEntry`, then add the import + array reference below.
 *  One entry per file keeps parallel workers off this array. See
 *  `./entries/README.md`.
 */

import type { DesignReviewEntry } from "./types";

import { entry as review1 } from "./entries/2026-05-29-review-1";

const ENTRIES: DesignReviewEntry[] = [review1];

/** Reviews newest-first (slugs lead with the ISO date, so a descending string
 *  sort is chronological). */
export const DESIGN_REVIEWS: DesignReviewEntry[] = [...ENTRIES].sort((a, b) =>
  b.meta.slug.localeCompare(a.meta.slug),
);

export function getReviewBySlug(slug: string): DesignReviewEntry | undefined {
  return DESIGN_REVIEWS.find((e) => e.meta.slug === slug);
}
