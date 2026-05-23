/**
 * Scoring provider interface — the abstraction over "how is a conversation
 * scored." Phase 1 ships two implementations: MockScoringProvider for the
 * seed + demo (deterministic faker), and ClaudeScoringProvider as a stub
 * that will be wired up at SVP-67. Swapping providers is a one-line config
 * change (QA_SCORING_PROVIDER env var) — same call sites, same shapes.
 *
 * Keep this file free of `db` / `drizzle` imports. The provider takes plain
 * shapes and returns plain shapes; the seed and any future app code maps
 * those into DB inserts. This separation is the seam that makes the real
 * LLM swap painless (and keeps the provider unit-testable without a DB).
 */

import type { ScorecardScaleType } from "@/db/schema";

/** Inputs to scoreConversation — everything the provider needs to score one
 *  ticket end-to-end. Resolved by the caller from DB rows (in seed) or from
 *  a route handler (in app code). */
export type ScoringInput = {
  ticket: {
    id: string;
    subject: string;
    channel: string;
    status: string;
    priority: string;
    createdAt: Date;
    solvedAt: Date | null;
    tags: string[];
  };
  /** Full message log (customer + agent + system) in chronological order.
   *  Message ids surface in highlighted_message_ids on the output, which is
   *  what the supporting-message highlight UI (SVP-54) reads. */
  messages: ScoringMessage[];
  /** The scorecard to score against, in resolved shape (no DB roundtrips
   *  inside the provider). */
  scorecard: ScoringScorecard;
};

export type ScoringMessage = {
  id: string;
  authorRole: "customer" | "agent" | "system";
  authorName: string | null;
  body: string;
  isPublic: boolean;
  createdAt: Date;
};

export type ScoringScorecard = {
  id: string;
  name: string;
  version: number;
  autoFailFloor: number;
  categories: ScoringCategory[];
};

export type ScoringCategory = {
  id: string;
  name: string;
  description: string;
  weightPercent: number;
  scaleType: ScorecardScaleType;
  isAutofail: boolean;
  criteria: ScoringCriterion[];
};

export type ScoringCriterion = {
  id: string;
  text: string;
};

/** Output shape — what the provider returns. Plain JSON; no DB types. The
 *  caller (seed or route handler) maps this onto rows in `evaluations` +
 *  `evaluation_category_scores` + `coaching_notes`. */
export type ScoringOutput = {
  /** 0-100 weighted overall score. */
  overallScore: number;
  /** Provider identity — written to evaluations.ai_model. */
  aiModel: string;
  /** 0-1 self-reported confidence. Stored as integer percent (0-100) in the
   *  DB; the provider returns the float and the caller projects. */
  aiConfidence: number;
  aiReasoningSummary: string;
  /** Did any auto-fail criterion fail? Caller may inspect to decide which
   *  status / floor to apply; the overall score already reflects the floor. */
  autoFailTriggered: boolean;
  categoryScores: ScoringCategoryResult[];
  coachingNote: ScoringCoachingNote;
};

export type ScoringCategoryResult = {
  categoryId: string;
  /** Score on the category's native scale. For likert_5: 1-5. For binary:
   *  0 (fail) or 1 (pass). For three_state: 0 / 1 / 2. */
  aiScore: number;
  aiReasoning: string;
  /** Message ids on the parent ticket that drove the score. Used by the
   *  supporting-message highlight UI (SVP-54). 0-3 ids typical. */
  highlightedMessageIds: string[];
};

export type ScoringCoachingNote = {
  /** Max 3 per PRD D-3 — enforced at the provider layer. */
  strengthPoints: string[];
  growthPoints: string[];
  exampleMessageIds: string[];
};

export interface ScoringProvider {
  /** Provider identity — written to evaluations.ai_model and scored_by. */
  readonly name: string;
  /** Score a single conversation. The provider may run synchronously (mock)
   *  or hit an LLM (claude); callers always await. */
  scoreConversation(input: ScoringInput): Promise<ScoringOutput>;
}
