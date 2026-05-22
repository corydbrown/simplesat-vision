import {
  DATE_OPS,
  ENUM_OPS,
  NUMERIC_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { PropertyFilter } from "@/lib/properties/types";

export const TICKET_STATUS = ["open", "pending", "solved", "closed"];
export const TICKET_PRIORITY = ["low", "normal", "high", "urgent"];
export const TICKET_CHANNEL = ["email", "chat", "phone", "social"];
export const TICKET_HELPDESK = ["zendesk", "gladly", "gorgias", "intercom"];

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
} as const satisfies Record<string, PropertyFilter>;

export type TicketFilterSpecId = keyof typeof TICKET_FILTER_SPECS;
