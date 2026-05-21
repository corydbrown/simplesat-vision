import "server-only";
import { and, asc, desc, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db, schema } from "../client";
import type { SortSpec } from "@/lib/sort/url-state";
import { customersViewWhere } from "@/lib/view-predicates";
import type { Customer, CustomerTier } from "../schema";

export type CustomerListRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  companyExternalId: string | null;
  companyDomain: string | null;
  language: string | null;
  tier: CustomerTier;
  customProperties: Record<string, unknown>;
  totalTickets: number;
  avgRating: number | null;
  lastSeen: Date | null;
};

const totalTicketsExpr = sql<number>`(SELECT COUNT(*) FROM tickets WHERE tickets.customer_id = customers.id)`;
const avgRatingExpr = sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.customer_id = customers.id)`;
const lastSeenExpr = sql<number | null>`(SELECT MAX(tickets.created_at) FROM tickets WHERE tickets.customer_id = customers.id)`;

const CUSTOMER_SORT_MAP: Record<string, AnyColumn | SQL> = {
  name: schema.customers.name,
  email: schema.customers.email,
  tier: schema.customers.tier,
  language: schema.customers.language,
  company: schema.customers.company,
  company_external_id: schema.customers.companyExternalId,
  company_domain: schema.customers.companyDomain,
  id: schema.customers.id,
  total_tickets: totalTicketsExpr,
  avg_rating: avgRatingExpr,
  last_seen: lastSeenExpr,
};

function buildCustomerOrderBy(sorts: SortSpec[]): SQL[] {
  const out: SQL[] = [];
  for (const s of sorts) {
    const col = CUSTOMER_SORT_MAP[s.key];
    if (!col) continue;
    out.push(s.dir === "asc" ? asc(col) : desc(col));
  }
  if (out.length === 0) out.push(desc(lastSeenExpr));
  return out;
}

export async function listCustomers({
  view,
  sorts = [],
}: {
  view?: string;
  sorts?: SortSpec[];
} = {}): Promise<{ rows: CustomerListRow[]; total: number }> {
  const tierWhere = view ? customersViewWhere(view) : undefined;
  const atRiskWhere =
    view === "at-risk"
      ? sql`(SELECT COUNT(*) FROM responses WHERE responses.customer_id = customers.id) >= 3 AND (SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.customer_id = customers.id) < 3`
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
      companyExternalId: schema.customers.companyExternalId,
      companyDomain: schema.customers.companyDomain,
      language: schema.customers.language,
      tier: schema.customers.tier,
      customProperties: schema.customers.customProperties,
      totalTickets: totalTicketsExpr,
      avgRating: avgRatingExpr,
      lastSeen: lastSeenExpr,
    })
    .from(schema.customers);

  const rows = await (where ? baseQuery.where(where) : baseQuery).orderBy(
    ...buildCustomerOrderBy(sorts),
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

export async function getCustomerTickets(
  customerId: string,
  limit = 50,
): Promise<import("./tickets").TicketsRow[]> {
  const rawRows = await db
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
    .where(eq(schema.tickets.customerId, customerId))
    .orderBy(desc(schema.tickets.createdAt))
    .limit(limit);

  return rawRows.map((r) => ({
    ...r.ticket,
    customer: r.customer?.id ? r.customer : null,
    assignee: r.assignee?.id ? r.assignee : null,
    response: r.response?.id ? r.response : null,
  }));
}

export async function getCustomerResponses(
  customerId: string,
  limit = 50,
): Promise<import("./responses").ResponseListRow[]> {
  return db
    .select({
      id: schema.responses.id,
      rating: schema.responses.rating,
      scale: schema.responses.scale,
      comment: schema.responses.comment,
      respondedAt: schema.responses.respondedAt,
      answers: schema.responses.answers,
      ticketId: schema.tickets.id,
      ticketSubject: schema.tickets.subject,
      ticketExternalId: schema.tickets.helpdeskExternalId,
      customerId: schema.customers.id,
      customerName: schema.customers.name,
      customerCompany: schema.customers.company,
      teamMemberId: schema.teamMembers.id,
      teamMemberName: schema.teamMembers.name,
      teamMemberAvatarColor: schema.teamMembers.avatarColor,
    })
    .from(schema.responses)
    .leftJoin(
      schema.tickets,
      eq(schema.tickets.id, schema.responses.ticketId),
    )
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, schema.responses.customerId),
    )
    .leftJoin(
      schema.teamMembers,
      eq(schema.teamMembers.id, schema.responses.teamMemberId),
    )
    .where(eq(schema.responses.customerId, customerId))
    .orderBy(desc(schema.responses.respondedAt))
    .limit(limit);
}
