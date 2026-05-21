import "server-only";
import { schema } from "@/db/client";
import {
  DATE_OPS,
  ENUM_OPS,
  NUMERIC_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { ListFilterFieldMap } from "../compile-list";

const TICKET_STATUS = ["open", "pending", "solved", "closed"];
const TICKET_PRIORITY = ["low", "normal", "high", "urgent"];
const CHANNEL = ["email", "chat", "phone", "social"];
const HELPDESK = ["zendesk", "gladly", "gorgias", "intercom"];

export const TICKET_FILTER_FIELDS: ListFilterFieldMap = {
  status: {
    id: "status",
    dataType: "enum",
    ops: ENUM_OPS,
    enumValues: TICKET_STATUS,
    column: schema.tickets.status,
  },
  priority: {
    id: "priority",
    dataType: "enum",
    ops: ENUM_OPS,
    enumValues: TICKET_PRIORITY,
    column: schema.tickets.priority,
  },
  channel: {
    id: "channel",
    dataType: "enum",
    ops: ENUM_OPS,
    enumValues: CHANNEL,
    column: schema.tickets.channel,
  },
  helpdesk: {
    id: "helpdesk",
    dataType: "enum",
    ops: ENUM_OPS,
    enumValues: HELPDESK,
    column: schema.tickets.helpdesk,
  },
  subject: {
    id: "subject",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.tickets.subject,
  },
  external_id: {
    id: "external_id",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.tickets.helpdeskExternalId,
  },
  message_count: {
    id: "message_count",
    dataType: "number",
    ops: NUMERIC_OPS,
    column: schema.tickets.messageCount,
  },
  agent_message_count: {
    id: "agent_message_count",
    dataType: "number",
    ops: NUMERIC_OPS,
    column: schema.tickets.agentMessageCount,
  },
  created_at: {
    id: "created_at",
    dataType: "date",
    ops: DATE_OPS,
    column: schema.tickets.createdAt,
  },
  first_response_at: {
    id: "first_response_at",
    dataType: "date",
    ops: DATE_OPS,
    column: schema.tickets.firstResponseAt,
  },
  solved_at: {
    id: "solved_at",
    dataType: "date",
    ops: DATE_OPS,
    column: schema.tickets.solvedAt,
  },
  closed_at: {
    id: "closed_at",
    dataType: "date",
    ops: DATE_OPS,
    column: schema.tickets.closedAt,
  },
};
