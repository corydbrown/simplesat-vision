import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "../client";
import { customersViewWhere } from "@/lib/view-predicates";
import type { Customer, CustomerTier } from "../schema";

export type CustomerListRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  tier: CustomerTier;
  totalTickets: number;
  avgRating: number | null;
  lastSeen: Date | null;
};

const totalTicketsExpr = sql<number>`(SELECT COUNT(*) FROM tickets WHERE tickets.customer_id = ${schema.customers.id})`;
const avgRatingExpr = sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.customer_id = ${schema.customers.id})`;
const lastSeenExpr = sql<number | null>`(SELECT MAX(created_at) FROM tickets WHERE tickets.customer_id = ${schema.customers.id})`;

export async function listCustomers({
  view,
}: {
  view?: string;
} = {}): Promise<{ rows: CustomerListRow[]; total: number }> {
  const tierWhere = view ? customersViewWhere(view) : undefined;
  const atRiskWhere =
    view === "at-risk"
      ? sql`(SELECT COUNT(*) FROM responses WHERE responses.customer_id = ${schema.customers.id}) >= 3 AND (SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.customer_id = ${schema.customers.id}) < 3`
      : undefined;

  const conditions = [tierWhere, atRiskWhere].filter(
    (c): c is SQL => c !== undefined,
  );
  const where =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  const baseQuery = db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      email: schema.customers.email,
      company: schema.customers.company,
      tier: schema.customers.tier,
      totalTickets: totalTicketsExpr,
      avgRating: avgRatingExpr,
      lastSeen: lastSeenExpr,
    })
    .from(schema.customers);

  const rows = await (where ? baseQuery.where(where) : baseQuery).orderBy(
    desc(lastSeenExpr),
  );

  return {
    rows: rows.map((r) => ({
      ...r,
      avgRating: r.avgRating != null ? Number(r.avgRating) : null,
      totalTickets: Number(r.totalTickets),
      lastSeen: r.lastSeen != null ? new Date(Number(r.lastSeen)) : null,
    })),
    total: rows.length,
  };
}

export type CustomerDetail = Customer & {
  stats: {
    totalTickets: number;
    avgRating: number | null;
    totalResponses: number;
    lastSeen: Date | null;
  };
};

export async function getCustomerById(
  id: string,
): Promise<CustomerDetail | null> {
  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id))
    .limit(1);
  if (!customer) return null;

  const [stats] = await db
    .select({
      totalTickets: sql<number>`(SELECT COUNT(*) FROM tickets WHERE customer_id = ${id})`,
      avgRating: sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE customer_id = ${id})`,
      totalResponses: sql<number>`(SELECT COUNT(*) FROM responses WHERE customer_id = ${id})`,
      lastSeen: sql<number | null>`(SELECT MAX(created_at) FROM tickets WHERE customer_id = ${id})`,
    })
    .from(schema.customers)
    .limit(1);

  return {
    ...customer,
    stats: {
      totalTickets: Number(stats?.totalTickets ?? 0),
      avgRating:
        stats?.avgRating != null ? Number(stats.avgRating) : null,
      totalResponses: Number(stats?.totalResponses ?? 0),
      lastSeen:
        stats?.lastSeen != null ? new Date(Number(stats.lastSeen)) : null,
    },
  };
}

export type CustomerTicketRow = {
  id: string;
  subject: string;
  status: string;
  channel: string;
  createdAt: Date;
  solvedAt: Date | null;
  rating: number | null;
  scale: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatarColor: string | null;
};

export async function getCustomerTickets(
  customerId: string,
  limit = 50,
): Promise<CustomerTicketRow[]> {
  const rows = await db
    .select({
      id: schema.tickets.id,
      subject: schema.tickets.subject,
      status: schema.tickets.status,
      channel: schema.tickets.channel,
      createdAt: schema.tickets.createdAt,
      solvedAt: schema.tickets.solvedAt,
      rating: schema.responses.rating,
      scale: schema.responses.scale,
      assigneeId: schema.teamMembers.id,
      assigneeName: schema.teamMembers.name,
      assigneeAvatarColor: schema.teamMembers.avatarColor,
    })
    .from(schema.tickets)
    .leftJoin(
      schema.responses,
      eq(schema.responses.ticketId, schema.tickets.id),
    )
    .leftJoin(
      schema.teamMembers,
      eq(schema.teamMembers.id, schema.tickets.assignedTeamMemberId),
    )
    .where(eq(schema.tickets.customerId, customerId))
    .orderBy(desc(schema.tickets.createdAt))
    .limit(limit);

  return rows;
}
