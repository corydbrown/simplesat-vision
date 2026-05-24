import "server-only";
import { schema } from "@/db/client";
import type { GroupFieldMap } from "../compile";

export const COACHING_GROUP_FIELDS: GroupFieldMap = {
  status: schema.evaluations.status,
  // Ordering by raw score keeps the "Excellent / Good / Needs attention /
  // Poor / Auto-failed" buckets contiguous; the client-side `groupValue`
  // snaps each row to its qa bucket label.
  overall_score: schema.evaluations.overallScore,
  scored_team_member: schema.teamMembers.name,
  scorecard: schema.scorecards.name,
};

export const COACHING_GROUP_IDS = Object.keys(COACHING_GROUP_FIELDS);
