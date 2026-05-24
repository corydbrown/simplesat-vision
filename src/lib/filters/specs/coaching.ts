import {
  BOOLEAN_OPS,
  DATE_OPS,
  ENUM_OPS,
  NUMERIC_OPS,
  RELATION_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { PropertyFilter } from "@/lib/properties/types";

export const COACHING_STATUS = [
  "ai_scored",
  "edited",
  "contested",
  "invalidated",
  "finalized",
];

/** Per-property filter metadata for evaluations (the Coaching entity). Single
 *  source of truth — the server-only field map in `../fields/coaching.ts`
 *  binds Drizzle column refs, and the property registry in
 *  `@/lib/properties/coaching.tsx` consumes these as the `filter:` value. */
export const COACHING_FILTER_SPECS = {
  status: { dataType: "enum", ops: ENUM_OPS, enumValues: COACHING_STATUS },
  overall_score: { dataType: "number", ops: NUMERIC_OPS },
  ai_confidence: { dataType: "number", ops: NUMERIC_OPS },
  scored_at: { dataType: "date", ops: DATE_OPS },
  edited_at: { dataType: "date", ops: DATE_OPS },
  // Relations — only isnull/notnull/in/not-in surface today; populated value
  // pickers ship later alongside the team-member chooser.
  scored_team_member: { dataType: "relation", ops: RELATION_OPS },
  scorecard: { dataType: "relation", ops: RELATION_OPS },
  ticket: { dataType: "relation", ops: RELATION_OPS },
  // Free-text subject lookup so a manager can dig out evaluations attached
  // to a specific conversation without flipping over to the tickets list.
  ticket_subject: { dataType: "string", ops: STRING_OPS },
  // `auto_failed` is derived in SQL: an evaluation auto-fails when at least
  // one of its category scores is on an auto-fail-flagged category AND the
  // effective score is below the binary threshold. Exposed as a boolean so
  // the "Auto-failed this week" saved view filters cleanly.
  auto_failed: { dataType: "boolean", ops: BOOLEAN_OPS },
} as const satisfies Record<string, PropertyFilter>;

export type CoachingFilterSpecId = keyof typeof COACHING_FILTER_SPECS;
