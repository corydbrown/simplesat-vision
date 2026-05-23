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

// Ticket-event derived "signal" expressions — PRD Part 8 differentiator. All
// computed on the fly via correlated subqueries against `ticket_events` and
// `ticket_messages` (no schema changes, no materialized columns). Boolean
// signals return 0/1 from EXISTS so they bind to the boolean eq/neq op set.
//
// `had_transfer` / `reassignment_count` filter on previous_value IS NOT NULL
// to exclude the initial system assignment — every ticket carries one of those
// at creation and including them would make these signals identically true
// across the dataset. A "transfer" is a reassignment away from a prior agent.
export const ticketHadTransferExpr = sql<number>`(SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'assignee_changed' AND ticket_events.previous_value IS NOT NULL))`;
export const ticketReassignmentCountExpr = sql<number>`(SELECT COUNT(*) FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'assignee_changed' AND ticket_events.previous_value IS NOT NULL)`;
// Hours from ticket creation to first agent message. NULL when no agent has
// replied. Stored as floating hours so users can express sub-hour cutoffs.
export const ticketQueueWaitHoursExpr = sql<number | null>`((SELECT MIN(ticket_messages.created_at) FROM ticket_messages WHERE ticket_messages.ticket_id = tickets.id AND ticket_messages.author_role = 'agent') - tickets.created_at) / 3600000.0`;
export const ticketSlaBreachedExpr = sql<number>`(SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'sla_breached'))`;
// The schema has no `escalated` verb; the actionable shape of an escalation in
// the seed is a `priority_changed` event whose new priority is high or urgent.
// Derive from that signal so the filter is usable without a schema migration.
export const ticketEscalatedExpr = sql<number>`(SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'priority_changed' AND ticket_events.new_value IN ('high', 'urgent')))`;
export const ticketCustomerReplyCountExpr = sql<number>`(SELECT COUNT(*) FROM ticket_messages WHERE ticket_messages.ticket_id = tickets.id AND ticket_messages.author_role = 'customer')`;
// Longest gap (in hours) between consecutive activity entries — events and
// messages merged by created_at. Uses LAG() over the union so the gap is
// measured against the prior row regardless of which table it came from.
export const ticketLongestIdleHoursExpr = sql<number | null>`(SELECT MAX(gap_ms) / 3600000.0 FROM (SELECT created_at - LAG(created_at) OVER (ORDER BY created_at) AS gap_ms FROM (SELECT created_at FROM ticket_messages WHERE ticket_messages.ticket_id = tickets.id UNION ALL SELECT created_at FROM ticket_events WHERE ticket_events.ticket_id = tickets.id)))`;

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
  had_transfer: ticketHadTransferExpr,
  reassignment_count: ticketReassignmentCountExpr,
  queue_wait_hours: ticketQueueWaitHoursExpr,
  sla_breached: ticketSlaBreachedExpr,
  escalated: ticketEscalatedExpr,
  customer_reply_count: ticketCustomerReplyCountExpr,
  longest_idle_hours: ticketLongestIdleHoursExpr,
});
