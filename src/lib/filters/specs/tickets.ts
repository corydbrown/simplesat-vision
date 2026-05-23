import {
  DATE_OPS,
  ENUM_OPS,
  MULTI_ENUM_OPS,
  NUMERIC_OPS,
  RELATION_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { PropertyFilter } from "@/lib/properties/types";

export const TICKET_STATUS = ["open", "pending", "solved", "closed"];
export const TICKET_PRIORITY = ["low", "normal", "high", "urgent"];
export const TICKET_CHANNEL = ["email", "chat", "phone", "social"];
export const TICKET_HELPDESK = ["zendesk", "gladly", "gorgias", "intercom"];
export const QA_EVALUATION_STATUS = [
  "ai_scored",
  "edited",
  "contested",
  "invalidated",
  "finalized",
];

/** Per-property filter metadata for tickets. Single source of truth — the
 *  server-only field map in `../fields/tickets.ts` adds Drizzle column refs,
 *  and the property registry in `@/lib/properties/tickets.tsx` consumes
 *  these entries as the `filter:` value. */
export const TICKET_FILTER_SPECS = {
  status: { dataType: "enum", ops: ENUM_OPS, enumValues: TICKET_STATUS },
  priority: { dataType: "enum", ops: ENUM_OPS, enumValues: TICKET_PRIORITY },
  channel: { dataType: "enum", ops: ENUM_OPS, enumValues: TICKET_CHANNEL },
  helpdesk: { dataType: "enum", ops: ENUM_OPS, enumValues: TICKET_HELPDESK },
  subject: { dataType: "string", ops: STRING_OPS },
  external_id: { dataType: "string", ops: STRING_OPS },
  message_count: { dataType: "number", ops: NUMERIC_OPS },
  agent_message_count: { dataType: "number", ops: NUMERIC_OPS },
  created_at: { dataType: "date", ops: DATE_OPS },
  first_response_at: { dataType: "date", ops: DATE_OPS },
  solved_at: { dataType: "date", ops: DATE_OPS },
  closed_at: { dataType: "date", ops: DATE_OPS },
  // Assignment + survey status — power the Unassigned and "Survey not fired"
  // saved views. Only isnull/notnull surface meaningfully today.
  assignee_id: { dataType: "relation", ops: RELATION_OPS },
  survey_not_sent_reason: { dataType: "string", ops: STRING_OPS },
  // Response rating via correlated subquery — powers the Detractors view.
  // Numeric so users can express other rating cutoffs.
  response_rating: { dataType: "number", ops: NUMERIC_OPS },
  // QA overall score (0-100) via correlated subquery on evaluations. Numeric
  // so users can build any cutoff; the "Needs QA review" saved view binds
  // qa_score < 75.
  qa_score: { dataType: "number", ops: NUMERIC_OPS },
  // QA evaluation status — enum so saved views can isolate `invalidated`
  // tickets (manager-flagged) for re-scoring.
  qa_status: {
    dataType: "enum",
    ops: ENUM_OPS,
    enumValues: QA_EVALUATION_STATUS,
  },
  // Tags is a JSON-array column — multi_enum semantics. Values are
  // user-defined, so the popover fetches the distinct in-use set with
  // counts from the server.
  tags: {
    dataType: "multi_enum",
    ops: MULTI_ENUM_OPS,
    enumValuesSource: "dynamic",
    dynamicValuesKey: "ticket.tags",
  },
} as const satisfies Record<string, PropertyFilter>;

export type TicketFilterSpecId = keyof typeof TICKET_FILTER_SPECS;
