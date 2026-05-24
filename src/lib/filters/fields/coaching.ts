import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { buildFilterFields } from "@/lib/filters/build-fields";
import { COACHING_FILTER_SPECS } from "@/lib/filters/specs/coaching";

/** Ticket subject lookup via correlated subquery — lets a manager filter
 *  evaluations by a fragment of the parent ticket's subject without joining
 *  through the tickets list. */
export const evaluationTicketSubjectExpr = sql<string | null>`(SELECT subject FROM tickets WHERE tickets.id = evaluations.ticket_id)`;

/** "Did this evaluation auto-fail?" — true when any auto-fail-flagged
 *  category landed at the binary FALSE score for this evaluation. Mirrors
 *  the scoring provider's auto-fail clamp at the read path so the filter
 *  is decoupled from how the overall score is computed. */
export const evaluationAutoFailedExpr = sql<number>`(SELECT EXISTS(
  SELECT 1
    FROM evaluation_category_scores
    INNER JOIN scorecard_categories
      ON scorecard_categories.id = evaluation_category_scores.category_id
   WHERE evaluation_category_scores.evaluation_id = evaluations.id
     AND scorecard_categories.is_autofail = 1
     AND evaluation_category_scores.effective_score = 0
))`;

export const COACHING_FILTER_FIELDS = buildFilterFields(COACHING_FILTER_SPECS, {
  status: schema.evaluations.status,
  overall_score: schema.evaluations.overallScore,
  ai_confidence: schema.evaluations.aiConfidence,
  scored_at: schema.evaluations.scoredAt,
  edited_at: schema.evaluations.editedAt,
  scored_team_member: schema.evaluations.scoredTeamMemberId,
  scorecard: schema.evaluations.scorecardId,
  ticket: schema.evaluations.ticketId,
  ticket_subject: evaluationTicketSubjectExpr,
  auto_failed: evaluationAutoFailedExpr,
});
