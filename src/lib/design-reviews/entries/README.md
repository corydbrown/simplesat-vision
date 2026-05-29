# Design-review entries

One file per design review. Each exports a single `entry: DesignReviewEntry`
constant (gallery `meta` + the full `review`). One-file-per-entry keeps parallel
workers from colliding on the registry array — adding a review touches only this
folder plus one import + one array reference in [`../registry.ts`](../registry.ts).

## Adding a review

1. The `design-drift-audit` workflow drops its structured output as
   `design-reviews/<date>-review-<n>.json` (plus a human-readable `.md`) in the
   repo root. That JSON is the canonical source — don't hand-copy findings.
2. Create `entries/<date>-review-<n>.ts`:
   ```ts
   import { toReviewMeta } from "../derive-meta";
   import type { DesignReview, DesignReviewEntry } from "../types";
   import rawReview from "../../../../design-reviews/<date>-review-<n>.json";

   const review = rawReview as unknown as DesignReview;
   const header = {
     slug: "<date>-review-<n>",
     date: "<date>",
     reviewNumber: <n>,
     title: "<short title>",
     summary: "<one-line gallery summary; omit to fall back to the exec summary>",
     method: "<how it was generated>",
   } as const;

   export const entry: DesignReviewEntry = { meta: toReviewMeta(review, header), review };
   ```
3. Wire it into [`../registry.ts`](../registry.ts): one `import` line + one array entry.

The gallery at `/design` sorts by `slug` (descending = newest first); the detail
template at `/design/[slug]` renders the `review` payload generically — no
per-review page code.
