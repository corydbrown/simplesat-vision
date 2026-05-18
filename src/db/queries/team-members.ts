import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "../client";
import { teamMembersViewWhere } from "@/lib/view-predicates";
import type { TeamMember } from "../schema";

export type TeamMemberListRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  avatarColor: string;
  totalTickets: number;
  avgRating: number | null;
  totalResponses: number;
};

const totalTicketsExpr = sql<number>`(SELECT COUNT(*) FROM tickets WHERE tickets.assigned_team_member_id = team_members.id)`;
const avgRatingExpr = sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.team_member_id = team_members.id)`;
const totalResponsesExpr = sql<number>`(SELECT COUNT(*) FROM responses WHERE responses.team_member_id = team_members.id)`;

export async function listTeamMembers({
  view,
}: { view?: string } = {}): Promise<{
  rows: TeamMemberListRow[];
  total: number;
}> {
  const teamWhere = view ? teamMembersViewWhere(view) : undefined;
  const lowPerfWhere =
    view === "low-performers"
      ? sql`(SELECT COUNT(*) FROM responses WHERE responses.team_member_id = team_members.id) >= 20 AND (SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.team_member_id = team_members.id) < 3.5`
      : undefined;

  const conditions = [teamWhere, lowPerfWhere].filter(
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
      avatarColor: schema.teamMembers.avatarColor,
      totalTickets: totalTicketsExpr,
      avgRating: avgRatingExpr,
      totalResponses: totalResponsesExpr,
    })
    .from(schema.teamMembers);

  const rows = await (where ? baseQuery.where(where) : baseQuery).orderBy(
    desc(totalTicketsExpr),
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

export type TeamMemberTicketRow = {
  id: string;
  subject: string;
  status: string;
  channel: string;
  createdAt: Date;
  solvedAt: Date | null;
  rating: number | null;
  scale: number | null;
  customerId: string | null;
  customerName: string | null;
};

export async function getTeamMemberTickets(
  memberId: string,
  limit = 50,
): Promise<TeamMemberTicketRow[]> {
  return db
    .select({
      id: schema.tickets.id,
      subject: schema.tickets.subject,
      status: schema.tickets.status,
      channel: schema.tickets.channel,
      createdAt: schema.tickets.createdAt,
      solvedAt: schema.tickets.solvedAt,
      rating: schema.responses.rating,
      scale: schema.responses.scale,
      customerId: schema.customers.id,
      customerName: schema.customers.name,
    })
    .from(schema.tickets)
    .leftJoin(
      schema.responses,
      eq(schema.responses.ticketId, schema.tickets.id),
    )
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, schema.tickets.customerId),
    )
    .where(eq(schema.tickets.assignedTeamMemberId, memberId))
    .orderBy(desc(schema.tickets.createdAt))
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
