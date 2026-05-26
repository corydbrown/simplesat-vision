import "server-only";
import { and, asc, desc, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db, schema } from "../client";
import { requireWorkspace } from "@/lib/workspace";
import { compileListFilters } from "@/lib/filters/compile-list";
import {
  CUSTOMER_FILTER_FIELDS,
  customerAvgRatingExpr,
  customerLastSeenExpr,
  customerTotalTicketsExpr,
} from "@/lib/filters/fields/customers";
import {
  ticketQaScoreExpr,
  ticketQaStatusExpr,
} from "@/lib/filters/fields/tickets";
import { TICKET_SIGNAL_SELECT, mapSignals } from "./tickets";
import type { Filter } from "@/lib/filters/types";
import { compileGroupOrderBy } from "@/lib/group/compile";
import { CUSTOMER_GROUP_FIELDS } from "@/lib/group/fields/customers";
import { TICKET_GROUP_FIELDS } from "@/lib/group/fields/tickets";
import { RESPONSE_GROUP_FIELDS } from "@/lib/group/fields/responses";
import type { GroupSpec } from "@/lib/group/types";
import type { SortSpec } from "@/lib/sort/url-state";
import { CUSTOMER_CUSTOM_FIELDS_BY_ID } from "@/lib/properties/custom-fields";
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

// Local aliases (existing callsites used the short names). Expressions live
// in the filter field map to break the import cycle (the field map must not
// depend on this file).
const totalTicketsExpr = customerTotalTicketsExpr;
const avgRatingExpr = customerAvgRatingExpr;
const lastSeenExpr = customerLastSeenExpr;

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

function customerCustomFieldOrderExpr(defId: string): SQL | null {
  const def = CUSTOMER_CUSTOM_FIELDS_BY_ID[defId];
  if (!def) return null;
  // Path is bound as a parameter (not interpolated into the SQL string) so
  // the def id can't influence SQL parsing even though ids are curated today.
  const path = `$.${defId}`;
  if (def.dataType === "number") {
    return sql`CAST(json_extract(customers.custom_properties, ${path}) AS REAL)`;
  }
  return sql`json_extract(customers.custom_properties, ${path})`;
}

function buildCustomerOrderBy(sorts: SortSpec[]): SQL[] {
  const out: SQL[] = [];
  for (const s of sorts) {
    let col: AnyColumn | SQL | null | undefined;
    if (s.key.startsWith("cf_")) {
      col = customerCustomFieldOrderExpr(s.key.slice(3));
    } else {
      col = CUSTOMER_SORT_MAP[s.key];
    }
    if (!col) continue;
    out.push(s.dir === "asc" ? asc(col) : desc(col));
  }
  if (out.length === 0) out.push(desc(lastSeenExpr));
  return out;
}

export async function listCustomers({
  sorts = [],
  groupBy,
  filters,
}: {
  sorts?: SortSpec[];
  groupBy?: GroupSpec | null;
  filters?: Filter[];
} = {}): Promise<{ rows: CustomerListRow[]; total: number }> {
  const workspaceId = await requireWorkspace();
  const filterWhere = filters
    ? compileListFilters(filters, CUSTOMER_FILTER_FIELDS)
    : undefined;
  const workspaceWhere = eq(schema.customers.workspaceId, workspaceId);
  const where = filterWhere ? and(workspaceWhere, filterWhere) : workspaceWhere;

  // Per-customer aggregates, computed once per workspace and joined back onto
  // the customer row. Replaces three correlated scalar subqueries that fanned
  // out to thousands of index seeks per request (see comment in
  // src/lib/filters/fields/customers.ts and SVP-162).
  //
  // The aliases (`t_agg`, `r_agg`) are referenced by literal SQL in the
  // customer field expressions; keep them stable.
  const ticketAgg = db
    .select({
      customerId: schema.tickets.customerId,
      totalTickets: sql<number>`COUNT(*)`.as("total_tickets"),
      lastSeen: sql<number | null>`MAX(${schema.tickets.createdAt})`.as(
        "last_seen",
      ),
    })
    .from(schema.tickets)
    .where(eq(schema.tickets.workspaceId, workspaceId))
    .groupBy(schema.tickets.customerId)
    .as("t_agg");

  const responseAgg = db
    .select({
      customerId: schema.responses.customerId,
      avgRating: sql<number | null>`AVG(CAST(${schema.responses.rating} AS REAL))`.as(
        "avg_rating",
      ),
    })
    .from(schema.responses)
    .where(eq(schema.responses.workspaceId, workspaceId))
    .groupBy(schema.responses.customerId)
    .as("r_agg");

  const groupOrderBy = compileGroupOrderBy(groupBy ?? null, CUSTOMER_GROUP_FIELDS);

  const rows = await db
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
    .from(schema.customers)
    .leftJoin(ticketAgg, eq(ticketAgg.customerId, schema.customers.id))
    .leftJoin(responseAgg, eq(responseAgg.customerId, schema.customers.id))
    .where(where)
    .orderBy(...groupOrderBy, ...buildCustomerOrderBy(sorts));

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
  const workspaceId = await requireWorkspace();
  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(
      and(
        eq(schema.customers.id, id),
        eq(schema.customers.workspaceId, workspaceId),
      ),
    )
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
  groupBy?: GroupSpec | null,
): Promise<import("./tickets").TicketsRow[]> {
  const workspaceId = await requireWorkspace();
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
      qaScore: ticketQaScoreExpr,
      qaStatus: ticketQaStatusExpr,
      ...TICKET_SIGNAL_SELECT,
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
    .where(
      and(
        eq(schema.tickets.customerId, customerId),
        eq(schema.tickets.workspaceId, workspaceId),
      ),
    )
    .orderBy(
      ...compileGroupOrderBy(groupBy ?? null, TICKET_GROUP_FIELDS),
      desc(schema.tickets.createdAt),
    )
    .limit(limit);

  return rawRows.map((r) => ({
    ...r.ticket,
    customer: r.customer?.id ? r.customer : null,
    assignee: r.assignee?.id ? r.assignee : null,
    response: r.response?.id ? r.response : null,
    qaScore: r.qaScore,
    qaStatus: r.qaStatus,
    signals: mapSignals(r),
  }));
}

export async function getCustomerResponses(
  customerId: string,
  limit = 50,
  groupBy?: GroupSpec | null,
): Promise<import("./responses").ResponseListRow[]> {
  const workspaceId = await requireWorkspace();
  const groupOrderBy = compileGroupOrderBy(groupBy ?? null, RESPONSE_GROUP_FIELDS);
  return db
    .select({
      id: schema.responses.id,
      rating: schema.responses.rating,
      scale: schema.responses.scale,
      comment: schema.responses.comment,
      respondedAt: schema.responses.respondedAt,
      answers: schema.responses.answers,
      topics: schema.responses.topics,
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
    .where(
      and(
        eq(schema.responses.customerId, customerId),
        eq(schema.responses.workspaceId, workspaceId),
      ),
    )
    .orderBy(...groupOrderBy, desc(schema.responses.respondedAt))
    .limit(limit);
}
