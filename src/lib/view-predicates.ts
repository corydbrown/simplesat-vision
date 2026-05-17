import "server-only";
import {
  and,
  eq,
  exists,
  gte,
  isNotNull,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { db, schema } from "@/db/client";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const weekAgo = () => new Date(Date.now() - WEEK_MS);

export function ticketsViewWhere(viewId: string): SQL | undefined {
  switch (viewId) {
    case "open":
      return eq(schema.tickets.status, "open");
    case "unassigned":
      return isNull(schema.tickets.assignedTeamMemberId);
    case "rated":
      return exists(
        db
          .select({ one: schema.responses.id })
          .from(schema.responses)
          .where(eq(schema.responses.ticketId, schema.tickets.id)),
      );
    case "detractors":
      return exists(
        db
          .select({ one: schema.responses.id })
          .from(schema.responses)
          .where(
            and(
              eq(schema.responses.ticketId, schema.tickets.id),
              lte(schema.responses.rating, 2),
            ),
          ),
      );
    case "not-fired":
      return isNotNull(schema.tickets.surveyNotSentReason);
    case "this-week":
      return gte(schema.tickets.createdAt, weekAgo());
    default:
      return undefined;
  }
}

export function responsesViewWhere(viewId: string): SQL | undefined {
  switch (viewId) {
    case "detractors":
      return lte(schema.responses.rating, 2);
    case "promoters":
      return eq(schema.responses.rating, 5);
    case "with-comments":
      return isNotNull(schema.responses.comment);
    case "this-week":
      return gte(schema.responses.respondedAt, weekAgo());
    default:
      return undefined;
  }
}

export function customersViewWhere(viewId: string): SQL | undefined {
  switch (viewId) {
    case "enterprise":
      return eq(schema.customers.tier, "enterprise");
    case "pro":
      return eq(schema.customers.tier, "pro");
    case "starter":
      return eq(schema.customers.tier, "starter");
    // at-risk is computed (avg rating) - handled in customer queries directly
    default:
      return undefined;
  }
}

export function teamMembersViewWhere(viewId: string): SQL | undefined {
  switch (viewId) {
    case "tier-1":
      return eq(schema.teamMembers.team, "Tier 1");
    case "tier-2":
      return eq(schema.teamMembers.team, "Tier 2");
    // low-performers is computed - handled in team-member queries directly
    default:
      return undefined;
  }
}

export async function ticketsViewCounts(
  viewIds: string[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    viewIds.map(async (id) => {
      const where = ticketsViewWhere(id);
      const count = await db.$count(schema.tickets, where);
      return [id, count] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function responsesViewCounts(
  viewIds: string[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    viewIds.map(async (id) => {
      const where = responsesViewWhere(id);
      const count = await db.$count(schema.responses, where);
      return [id, count] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function customersViewCounts(
  viewIds: string[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    viewIds.map(async (id) => {
      if (id === "at-risk") {
        const rows = await db.all<{ c: number }>(sql`
          SELECT count(*) as c FROM (
            SELECT customer_id FROM responses
            GROUP BY customer_id
            HAVING count(*) >= 3 AND avg(rating) < 3
          )
        `);
        return [id, Number(rows[0]?.c ?? 0)] as const;
      }
      const where = customersViewWhere(id);
      const count = await db.$count(schema.customers, where);
      return [id, count] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function teamMembersViewCounts(
  viewIds: string[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    viewIds.map(async (id) => {
      if (id === "low-performers") {
        const rows = await db.all<{ c: number }>(sql`
          SELECT count(*) as c FROM (
            SELECT team_member_id FROM responses
            WHERE team_member_id IS NOT NULL
            GROUP BY team_member_id
            HAVING count(*) >= 20 AND avg(rating) < 3.5
          )
        `);
        return [id, Number(rows[0]?.c ?? 0)] as const;
      }
      const where = teamMembersViewWhere(id);
      const count = await db.$count(schema.teamMembers, where);
      return [id, count] as const;
    }),
  );
  return Object.fromEntries(entries);
}
