import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "../client";
import { compileListFilters } from "@/lib/filters/compile-list";
import { TICKET_FILTER_FIELDS } from "@/lib/filters/fields/tickets";
import type { Filter } from "@/lib/filters/types";
import { ticketsViewWhere } from "@/lib/view-predicates";
import type {
  Ticket,
  TicketMessageAuthorRole,
  TicketMessageChannel,
  TicketMessageType,
  TicketEventVerb,
} from "../schema";

export type TicketSortKey =
  | "createdAt"
  | "subject"
  | "status"
  | "priority"
  | "channel"
  | "closedAt"
  | "solvedAt";
export type SortDir = "asc" | "desc";

export type TicketsRow = Ticket & {
  customer: { id: string; name: string; company: string | null } | null;
  assignee: {
    id: string;
    name: string;
    avatarColor: string;
    team: string;
  } | null;
  response: {
    id: string;
    rating: number;
    scale: number;
    comment: string | null;
  } | null;
};

const SORT_COLUMN_MAP = {
  createdAt: schema.tickets.createdAt,
  subject: schema.tickets.subject,
  status: schema.tickets.status,
  priority: schema.tickets.priority,
  channel: schema.tickets.channel,
  closedAt: schema.tickets.closedAt,
  solvedAt: schema.tickets.solvedAt,
};

export async function listTickets({
  page,
  pageSize,
  sort,
  dir,
  view,
  filters,
}: {
  page: number;
  pageSize: number;
  sort: TicketSortKey;
  dir: SortDir;
  view?: string;
  filters?: Filter[];
}): Promise<{ rows: TicketsRow[]; total: number }> {
  const sortCol = SORT_COLUMN_MAP[sort];
  const orderBy = dir === "asc" ? asc(sortCol) : desc(sortCol);
  const viewWhere = view ? ticketsViewWhere(view) : undefined;
  const filterWhere = filters
    ? compileListFilters(filters, TICKET_FILTER_FIELDS)
    : undefined;
  const where =
    viewWhere && filterWhere
      ? and(viewWhere, filterWhere)
      : (viewWhere ?? filterWhere);

  const offset = (page - 1) * pageSize;

  const baseQuery = db
    .select({
      ticket: schema.tickets,
      customer: {
        id: schema.customers.id,
        name: schema.customers.name,
        company: schema.customers.company,
      },
      assignee: {
        id: schema.teamMembers.id,
        name: schema.teamMembers.name,
        avatarColor: schema.teamMembers.avatarColor,
        team: schema.teamMembers.team,
      },
      response: {
        id: schema.responses.id,
        rating: schema.responses.rating,
        scale: schema.responses.scale,
        comment: schema.responses.comment,
      },
    })
    .from(schema.tickets)
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, schema.tickets.customerId),
    )
    .leftJoin(
      schema.teamMembers,
      eq(schema.teamMembers.id, schema.tickets.assignedTeamMemberId),
    )
    .leftJoin(
      schema.responses,
      eq(schema.responses.ticketId, schema.tickets.id),
    );

  const [rawRows, total] = await Promise.all([
    (where ? baseQuery.where(where) : baseQuery)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db.$count(schema.tickets, where),
  ]);

  const rows: TicketsRow[] = rawRows.map((r) => ({
    ...r.ticket,
    customer: r.customer?.id ? r.customer : null,
    assignee: r.assignee?.id ? r.assignee : null,
    response: r.response?.id ? r.response : null,
  }));

  return { rows, total };
}

export type TicketMessageView = {
  id: string;
  authorRole: TicketMessageAuthorRole;
  channel: TicketMessageChannel;
  isPublic: boolean;
  type: TicketMessageType;
  body: string;
  createdAt: Date;
  customer: { id: string; name: string } | null;
  teamMember: {
    id: string;
    name: string;
    avatarColor: string;
  } | null;
};

export type TicketEventView = {
  id: string;
  verb: TicketEventVerb;
  fieldName: string | null;
  previousValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  actorRole: TicketMessageAuthorRole;
  actor:
    | { kind: "customer"; id: string; name: string }
    | { kind: "agent"; id: string; name: string; avatarColor: string }
    | { kind: "system" };
};

export type TicketDetail = TicketsRow & {
  messages: TicketMessageView[];
  events: TicketEventView[];
};

export async function getTicketById(id: string): Promise<TicketDetail | null> {
  const [r] = await db
    .select({
      ticket: schema.tickets,
      customer: {
        id: schema.customers.id,
        name: schema.customers.name,
        company: schema.customers.company,
      },
      assignee: {
        id: schema.teamMembers.id,
        name: schema.teamMembers.name,
        avatarColor: schema.teamMembers.avatarColor,
        team: schema.teamMembers.team,
      },
      response: {
        id: schema.responses.id,
        rating: schema.responses.rating,
        scale: schema.responses.scale,
        comment: schema.responses.comment,
      },
    })
    .from(schema.tickets)
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, schema.tickets.customerId),
    )
    .leftJoin(
      schema.teamMembers,
      eq(schema.teamMembers.id, schema.tickets.assignedTeamMemberId),
    )
    .leftJoin(
      schema.responses,
      eq(schema.responses.ticketId, schema.tickets.id),
    )
    .where(eq(schema.tickets.id, id))
    .limit(1);

  if (!r) return null;

  const [messageRows, eventRows] = await Promise.all([
    db
      .select({
        message: schema.ticketMessages,
        customer: {
          id: schema.customers.id,
          name: schema.customers.name,
        },
        teamMember: {
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          avatarColor: schema.teamMembers.avatarColor,
        },
      })
      .from(schema.ticketMessages)
      .leftJoin(
        schema.customers,
        eq(schema.customers.id, schema.ticketMessages.customerId),
      )
      .leftJoin(
        schema.teamMembers,
        eq(schema.teamMembers.id, schema.ticketMessages.teamMemberId),
      )
      .where(eq(schema.ticketMessages.ticketId, id))
      .orderBy(asc(schema.ticketMessages.createdAt)),
    db
      .select({
        event: schema.ticketEvents,
        customer: {
          id: schema.customers.id,
          name: schema.customers.name,
        },
        teamMember: {
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          avatarColor: schema.teamMembers.avatarColor,
        },
      })
      .from(schema.ticketEvents)
      .leftJoin(
        schema.customers,
        eq(schema.customers.id, schema.ticketEvents.actorCustomerId),
      )
      .leftJoin(
        schema.teamMembers,
        eq(schema.teamMembers.id, schema.ticketEvents.actorTeamMemberId),
      )
      .where(eq(schema.ticketEvents.ticketId, id))
      .orderBy(asc(schema.ticketEvents.createdAt)),
  ]);

  const messages: TicketMessageView[] = messageRows.map((m) => ({
    id: m.message.id,
    authorRole: m.message.authorRole,
    channel: m.message.channel,
    isPublic: m.message.isPublic,
    type: m.message.type,
    body: m.message.body,
    createdAt: m.message.createdAt,
    customer: m.customer?.id ? m.customer : null,
    teamMember: m.teamMember?.id ? m.teamMember : null,
  }));

  const events: TicketEventView[] = eventRows.map((e) => {
    const actor: TicketEventView["actor"] =
      e.event.actorRole === "customer" && e.customer?.id
        ? { kind: "customer", id: e.customer.id, name: e.customer.name }
        : e.event.actorRole === "agent" && e.teamMember?.id
          ? {
              kind: "agent",
              id: e.teamMember.id,
              name: e.teamMember.name,
              avatarColor: e.teamMember.avatarColor,
            }
          : { kind: "system" };
    return {
      id: e.event.id,
      verb: e.event.verb,
      fieldName: e.event.fieldName,
      previousValue: e.event.previousValue,
      newValue: e.event.newValue,
      metadata: e.event.metadata,
      createdAt: e.event.createdAt,
      actorRole: e.event.actorRole,
      actor,
    };
  });

  return {
    ...r.ticket,
    customer: r.customer?.id ? r.customer : null,
    assignee: r.assignee?.id ? r.assignee : null,
    response: r.response?.id ? r.response : null,
    messages,
    events,
  };
}
