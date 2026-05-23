import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db/client";
import type { QaEvaluationStatus } from "@/db/schema";
import { buildFilterFields, multiEnumColumn } from "@/lib/filters/build-fields";
import { TICKET_FILTER_SPECS } from "@/lib/filters/specs/tickets";

// Correlated subquery so the Detractors saved view (and any future rating
// cutoff) can filter tickets by their attached response rating.
export const ticketResponseRatingExpr = sql<number | null>`(SELECT rating FROM responses WHERE responses.ticket_id = tickets.id LIMIT 1)`;

// QA evaluation correlated subqueries — same pattern. Most tickets won't have
// an evaluation row (only the conversation-mockup subset is scored today), so
// these return NULL for unscored tickets, which is what the list cell + the
// "Needs QA review" filter both want.
export const ticketQaScoreExpr = sql<number | null>`(SELECT overall_score FROM evaluations WHERE evaluations.ticket_id = tickets.id ORDER BY scored_at DESC LIMIT 1)`;
export const ticketQaStatusExpr = sql<QaEvaluationStatus | null>`(SELECT status FROM evaluations WHERE evaluations.ticket_id = tickets.id ORDER BY scored_at DESC LIMIT 1)`;

// JSON-array column for multi_enum. Literal SQL fragment (not
// ${schema.tickets.tags}) so it interpolates as a raw column reference
// inside the EXISTS subquery — see CLAUDE.md → Conventions.
const ticketTagsExpr = sql`tickets.tags`;

export const TICKET_FILTER_FIELDS = buildFilterFields(TICKET_FILTER_SPECS, {
  status: schema.tickets.status,
  priority: schema.tickets.priority,
  channel: schema.tickets.channel,
  helpdesk: schema.tickets.helpdesk,
  subject: schema.tickets.subject,
  external_id: schema.tickets.helpdeskExternalId,
  message_count: schema.tickets.messageCount,
  agent_message_count: schema.tickets.agentMessageCount,
  created_at: schema.tickets.createdAt,
  first_response_at: schema.tickets.firstResponseAt,
  solved_at: schema.tickets.solvedAt,
  closed_at: schema.tickets.closedAt,
  assignee_id: schema.tickets.assignedTeamMemberId,
  survey_not_sent_reason: schema.tickets.surveyNotSentReason,
  response_rating: ticketResponseRatingExpr,
  qa_score: ticketQaScoreExpr,
  qa_status: ticketQaStatusExpr,
  tags: multiEnumColumn(ticketTagsExpr, sql`value`),
});
