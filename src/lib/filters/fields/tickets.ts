import "server-only";
import { schema } from "@/db/client";
import { buildFilterFields } from "@/lib/filters/build-fields";
import { TICKET_FILTER_SPECS } from "@/lib/filters/specs/tickets";

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
});
