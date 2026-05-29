import type {
  DesignReview,
  DesignReviewHeader,
  DesignReviewMeta,
} from "./types";

/** First sentence of a block of prose, trimmed. Used as the gallery summary
 *  fallback when a header doesn't author its own one-liner. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

/** Derive gallery-card metadata from a full review + its authored header.
 *  Pure: same inputs always yield the same card. The per-dimension strip
 *  mirrors the order dimensions appear in the review. */
export function toReviewMeta(
  review: DesignReview,
  header: DesignReviewHeader,
): DesignReviewMeta {
  return {
    slug: header.slug,
    date: header.date,
    reviewNumber: header.reviewNumber,
    title: header.title,
    summary:
      header.summary?.trim() || firstSentence(review.synthesis.executiveSummary),
    healthGrade: review.synthesis.healthGrade,
    method: header.method,
    dimensions: review.dimensions.map((d) => ({
      name: d.dimension,
      severity: d.severity,
      count: d.approxTotalCount,
    })),
  };
}
