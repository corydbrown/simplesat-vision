import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { buildFilterFields } from "@/lib/filters/build-fields";
import { TICKET_FILTER_SPECS } from "@/lib/filters/specs/tickets";

// Correlated subquery so the Detractors saved view (and any future rating
// cutoff) can filter tickets by their attached response rating.
export const ticketResponseRatingExpr = sql<number | null>`(SELECT rating FROM responses WHERE responses.ticket_id = tickets.id LIMIT 1)`;

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
});
