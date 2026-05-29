import { toReviewMeta } from "../derive-meta";
import type { DesignReview, DesignReviewEntry } from "../types";
// Canonical source: the audit JSON dropped by the `design-drift-audit` workflow
// into the repo-root `design-reviews/` zone. Imported directly so findings stay
// single-sourced — no hand-copied file:line detail to drift out of sync.
import rawReview from "../../../../design-reviews/2026-05-29-review-1.json";

const review = rawReview as unknown as DesignReview;

const header = {
  slug: "2026-05-29-review-1",
  date: "2026-05-29",
  reviewNumber: 1,
  title: "Production UI drift audit",
  summary:
    "Drift audit across components + workspace routes — overall health B, two live user-visible bugs plus an enforcement gap letting copy-paste drift accumulate.",
  method: "design-drift-audit workflow · run wf_9db95182 · 9 agents · ~7 min",
} as const;

export const entry: DesignReviewEntry = {
  meta: toReviewMeta(review, header),
  review,
};
