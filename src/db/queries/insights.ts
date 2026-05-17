import "server-only";
import { sql } from "drizzle-orm";
import { db, schema } from "../client";

export type DecliningCustomer = {
  id: string;
  name: string;
  company: string;
  avgRating: number;
  responseCount: number;
};

export type LowPerformingAgent = {
  id: string;
  name: string;
  team: string;
  avatarColor: string;
  avgRating: number;
  responseCount: number;
};

export type SurveysNotFiredBreakdown = {
  total: number;
  byReason: { reason: string; count: number }[];
};

export async function getDecliningCustomers(
  limit = 5,
): Promise<DecliningCustomer[]> {
  const rows = await db.all<{
    id: string;
    name: string;
    company: string;
    avg_rating: number;
    response_count: number;
  }>(sql`
    SELECT c.id, c.name, c.company,
      AVG(CAST(r.rating as REAL)) as avg_rating,
      COUNT(r.id) as response_count
    FROM customers c
    JOIN responses r ON r.customer_id = c.id
    GROUP BY c.id
    HAVING COUNT(r.id) >= 5
    ORDER BY avg_rating ASC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    company: r.company,
    avgRating: Number(r.avg_rating),
    responseCount: Number(r.response_count),
  }));
}

export async function getLowPerformingAgents(
  limit = 5,
): Promise<LowPerformingAgent[]> {
  const rows = await db.all<{
    id: string;
    name: string;
    team: string;
    avatar_color: string;
    avg_rating: number;
    response_count: number;
  }>(sql`
    SELECT tm.id, tm.name, tm.team, tm.avatar_color,
      AVG(CAST(r.rating as REAL)) as avg_rating,
      COUNT(r.id) as response_count
    FROM team_members tm
    JOIN responses r ON r.team_member_id = tm.id
    GROUP BY tm.id
    HAVING COUNT(r.id) >= 20
    ORDER BY avg_rating ASC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    team: r.team,
    avatarColor: r.avatar_color,
    avgRating: Number(r.avg_rating),
    responseCount: Number(r.response_count),
  }));
}

export async function getSurveysNotFiredThisWeek(): Promise<SurveysNotFiredBreakdown> {
  const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const rows = await db
    .select({
      reason: schema.tickets.surveyNotSentReason,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(schema.tickets)
    .where(
      sql`${schema.tickets.surveyNotSentReason} IS NOT NULL AND ${schema.tickets.createdAt} >= ${weekAgoMs}`,
    )
    .groupBy(schema.tickets.surveyNotSentReason);

  const byReason: { reason: string; count: number }[] = rows
    .filter((r): r is typeof r & { reason: string } => r.reason != null)
    .map((r) => ({ reason: r.reason, count: Number(r.count) }));
  const total = byReason.reduce((s, r) => s + r.count, 0);
  return { total, byReason };
}
