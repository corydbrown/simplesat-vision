import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../client";
import type { Ticket } from "../schema";

export type TicketSortKey =
  | "createdAt"
  | "subject"
  | "status"
  | "channel"
  | "closedAt"
  | "solvedAt";
export type SortDir = "asc" | "desc";

export type TicketsRow = Ticket & {
  customer: { id: string; name: string; company: string } | null;
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
  channel: schema.tickets.channel,
  closedAt: schema.tickets.closedAt,
  solvedAt: schema.tickets.solvedAt,
};

export async function listTickets({
  page,
  pageSize,
  sort,
  dir,
}: {
  page: number;
  pageSize: number;
  sort: TicketSortKey;
  dir: SortDir;
}): Promise<{ rows: TicketsRow[]; total: number }> {
  const sortCol = SORT_COLUMN_MAP[sort];
  const orderBy = dir === "asc" ? asc(sortCol) : desc(sortCol);

  const offset = (page - 1) * pageSize;

  const [rawRows, totalRow] = await Promise.all([
    db
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
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(schema.tickets),
  ]);

  const rows: TicketsRow[] = rawRows.map((r) => ({
    ...r.ticket,
    customer: r.customer?.id ? r.customer : null,
    assignee: r.assignee?.id ? r.assignee : null,
    response: r.response?.id ? r.response : null,
  }));

  return { rows, total: Number(totalRow[0]?.count ?? 0) };
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
