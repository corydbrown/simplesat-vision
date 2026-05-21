import "server-only";
import { schema } from "@/db/client";
import type { GroupFieldMap } from "../compile";

export const TICKET_GROUP_FIELDS: GroupFieldMap = {
  status: schema.tickets.status,
  priority: schema.tickets.priority,
  channel: schema.tickets.channel,
  helpdesk: schema.tickets.helpdesk,
  assignee: schema.teamMembers.name,
  company: schema.customers.company,
};

export const TICKET_GROUP_IDS = Object.keys(TICKET_GROUP_FIELDS);
