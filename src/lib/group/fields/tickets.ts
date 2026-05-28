import "server-only";
import { schema } from "@/db/client";
import {
  ticketAiHandlingExpr,
  ticketQaScoreExpr,
} from "@/lib/filters/fields/tickets";
import type { GroupFieldMap } from "../compile";

export const TICKET_GROUP_FIELDS: GroupFieldMap = {
  status: schema.tickets.status,
  priority: schema.tickets.priority,
  channel: schema.tickets.channel,
  source: schema.tickets.source,
  assignee: schema.teamMembers.name,
  organization: schema.customers.organization,
  // Ordering by the raw score keeps each bucket contiguous: ≥90 sorts above
  // 75–89 sorts above 60–74, etc. Client-side `groupValue` then snaps each
  // row to its bucket label.
  qa_score: ticketQaScoreExpr,
  // Derived bot_only/hybrid/human_only segment. SQL CASE mirrors
  // classifyAiHandling so the server-side group ordering matches the
  // client-side groupValue snap exactly.
  ai_handling: ticketAiHandlingExpr,
};

export const TICKET_GROUP_IDS = Object.keys(TICKET_GROUP_FIELDS);
