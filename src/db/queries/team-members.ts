import "server-only";
import { and, asc, desc, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db, schema } from "../client";
import { compileListFilters } from "@/lib/filters/compile-list";
import {
  TEAM_MEMBER_FILTER_FIELDS,
  teamMemberAvgRatingExpr,
  teamMemberTotalResponsesExpr,
  teamMemberTotalTicketsExpr,
} from "@/lib/filters/fields/team-members";
import type { Filter } from "@/lib/filters/types";
import { compileGroupOrderBy } from "@/lib/group/compile";
import { TEAM_MEMBER_GROUP_FIELDS } from "@/lib/group/fields/team-members";
import { TICKET_GROUP_FIELDS } from "@/lib/group/fields/tickets";
import { RESPONSE_GROUP_FIELDS } from "@/lib/group/fields/responses";
import type { GroupSpec } from "@/lib/group/types";
import type { SortSpec } from "@/lib/sort/url-state";
import { teamMembersViewWhere } from "@/lib/view-predicates";
import type { TeamMember } from "../schema";

export type TeamMemberListRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  region: string | null;
  language: string | null;
  groupId: string | null;
  groupName: string | null;
  avatarColor: string;
  customProperties: Record<string, unknown>;
  totalTickets: number;
  avgRating: number | null;
  totalResponses: number;
};

// Local aliases (existing callsites used the short names). Expressions live
// in the filter field map to break the import cycle (the field map must not
// depend on this file).
const totalTicketsExpr = teamMemberTotalTicketsExpr;
const avgRatingExpr = teamMemberAvgRatingExpr;
const totalResponsesExpr = teamMemberTotalResponsesExpr;

const TEAM_MEMBER_SORT_MAP: Record<string, AnyColumn | SQL> = {
  name: schema.teamMembers.name,
  role: schema.teamMembers.role,
  team: schema.teamMembers.team,
  region: schema.teamMembers.region,
  language: schema.teamMembers.language,
  group: schema.teamMemberGroups.name,
  email: schema.teamMembers.email,
  id: schema.teamMembers.id,
  total_tickets: totalTicketsExpr,
  total_responses: totalResponsesExpr,
  avg_rating: avgRatingExpr,
};

function buildTeamMemberOrderBy(sorts: SortSpec[]): SQL[] {
  const out: SQL[] = [];
  for (const s of sorts) {
    const col = TEAM_MEMBER_SORT_MAP[s.key];
    if (!col) continue;
    out.push(s.dir === "asc" ? asc(col) : desc(col));
  }
  if (out.length === 0) out.push(desc(totalTicketsExpr));
  return out;
}

export async function listTeamMembers({
  view,
  sorts = [],
  groupBy,
  filters,
}: {
  view?: string;
  sorts?: SortSpec[];
  groupBy?: GroupSpec | null;
  filters?: Filter[];
} = {}): Promise<{
  rows: TeamMemberListRow[];
  total: number;
}> {
  const teamWhere = view ? teamMembersViewWhere(view) : undefined;
  const lowPerfWhere =
    view === "low-performers"
      ? sql`(SELECT COUNT(*) FROM responses WHERE responses.team_member_id = team_members.id) >= 20 AND (SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.team_member_id = team_members.id) < 3.5`
      : undefined;
  const filterWhere = filters
    ? compileListFilters(filters, TEAM_MEMBER_FILTER_FIELDS)
    : undefined;

  const conditions = [teamWhere, lowPerfWhere, filterWhere].filter(
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
      id: schema.teamMembers.id,
      name: schema.teamMembers.name,
      email: schema.teamMembers.email,
      role: schema.teamMembers.role,
      team: schema.teamMembers.team,
      region: schema.teamMembers.region,
      language: schema.teamMembers.language,
      groupId: schema.teamMembers.groupId,
      groupName: schema.teamMemberGroups.name,
      avatarColor: schema.teamMembers.avatarColor,
      customProperties: schema.teamMembers.customProperties,
      totalTickets: totalTicketsExpr,
      avgRating: avgRatingExpr,
      totalResponses: totalResponsesExpr,
    })
    .from(schema.teamMembers)
    .leftJoin(
      schema.teamMemberGroups,
      eq(schema.teamMemberGroups.id, schema.teamMembers.groupId),
    );

  const groupOrderBy = compileGroupOrderBy(
    groupBy ?? null,
    TEAM_MEMBER_GROUP_FIELDS,
  );
  const rows = await (where ? baseQuery.where(where) : baseQuery).orderBy(
    ...groupOrderBy,
    ...buildTeamMemberOrderBy(sorts),
  );

  return {
    rows: rows.map((r) => ({
      ...r,
      avgRating: r.avgRating != null ? Number(r.avgRating) : null,
      totalTickets: Number(r.totalTickets),
      totalResponses: Number(r.totalResponses),
    })),
    total: rows.length,
  };
}

export type TeamMemberDetail = TeamMember & {
  stats: {
    totalTickets: number;
    avgRating: number | null;
    totalResponses: number;
  };
};

export async function getTeamMemberById(
  id: string,
): Promise<TeamMemberDetail | null> {
  const [member] = await db
    .select()
    .from(schema.teamMembers)
    .where(eq(schema.teamMembers.id, id))
    .limit(1);
  if (!member) return null;

  const [stats] = await db
    .select({
      totalTickets: sql<number>`(SELECT COUNT(*) FROM tickets WHERE assigned_team_member_id = ${id})`,
      avgRating: sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE team_member_id = ${id})`,
      totalResponses: sql<number>`(SELECT COUNT(*) FROM responses WHERE team_member_id = ${id})`,
    })
    .from(schema.teamMembers)
    .limit(1);

  return {
    ...member,
    stats: {
      totalTickets: Number(stats?.totalTickets ?? 0),
      avgRating: stats?.avgRating != null ? Number(stats.avgRating) : null,
      totalResponses: Number(stats?.totalResponses ?? 0),
    },
  };
}

export async function getTeamMemberTickets(
  memberId: string,
  limit = 50,
  groupBy?: GroupSpec | null,
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
    .where(eq(schema.tickets.assignedTeamMemberId, memberId))
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
  }));
}

export async function getTeamMemberResponses(
  memberId: string,
  limit = 50,
  groupBy?: GroupSpec | null,
): Promise<import("./responses").ResponseListRow[]> {
  const groupOrderBy = compileGroupOrderBy(groupBy ?? null, RESPONSE_GROUP_FIELDS);
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
    .where(eq(schema.responses.teamMemberId, memberId))
    .orderBy(...groupOrderBy, desc(schema.responses.respondedAt))
    .limit(limit);
}

export async function getRatingHistogram(
  memberId: string,
): Promise<{ rating: number; count: number }[]> {
  const rows = await db
    .select({
      rating: schema.responses.rating,
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(schema.responses)
    .where(eq(schema.responses.teamMemberId, memberId))
    .groupBy(schema.responses.rating);

  return rows.map((r) => ({
    rating: Number(r.rating),
    count: Number(r.count),
  }));
}
