import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "../client";
import { compileListFilters } from "@/lib/filters/compile-list";
import { TICKET_FILTER_FIELDS } from "@/lib/filters/fields/tickets";
import type { Filter } from "@/lib/filters/types";
import { ticketsViewWhere } from "@/lib/view-predicates";
import type { Ticket } from "../schema";

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

export type TicketDetail = TicketsRow;

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

  return {
    ...r.ticket,
    customer: r.customer?.id ? r.customer : null,
    assignee: r.assignee?.id ? r.assignee : null,
    response: r.response?.id ? r.response : null,
  };
}
