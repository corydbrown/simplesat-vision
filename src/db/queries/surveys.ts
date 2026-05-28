import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../client";
import { liveResponsesFilter } from "./live-responses";
import { requireWorkspace } from "@/lib/workspace";
import { compileGroupOrderBy } from "@/lib/group/compile";
import { RESPONSE_GROUP_FIELDS } from "@/lib/group/fields/responses";
import type { GroupSpec } from "@/lib/group/types";
import type { Survey } from "../schema";

export type SurveyRow = {
  id: string;
  name: string;
  metric: Survey["metric"];
  channel: Survey["channel"];
  status: Survey["status"];
  scale: number;
  totalResponses: number;
  avgRating: number | null;
  createdAt: Date;
};

// SVP-181: aggregate over live (non-superseded) responses only.
const totalResponsesExpr = sql<number>`(SELECT COUNT(*) FROM responses WHERE responses.survey_id = surveys.id AND responses.superseded_by IS NULL)`;
const avgRatingExpr = sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.survey_id = surveys.id AND responses.superseded_by IS NULL)`;

export async function listSurveys(): Promise<SurveyRow[]> {
  const workspaceId = await requireWorkspace();
  const rows = await db
    .select({
      id: schema.surveys.id,
      name: schema.surveys.name,
      metric: schema.surveys.metric,
      channel: schema.surveys.channel,
      status: schema.surveys.status,
      scale: schema.surveys.scale,
      totalResponses: totalResponsesExpr,
      avgRating: avgRatingExpr,
      createdAt: schema.surveys.createdAt,
    })
    .from(schema.surveys)
    .where(eq(schema.surveys.workspaceId, workspaceId))
    .orderBy(desc(totalResponsesExpr));

  return rows.map((r) => ({
    ...r,
    totalResponses: Number(r.totalResponses),
    avgRating: r.avgRating != null ? Number(r.avgRating) : null,
  }));
}

export type SurveyDetail = Survey & {
  stats: {
    totalResponses: number;
    avgRating: number | null;
    lastResponseAt: Date | null;
  };
};

export async function getSurveyById(id: string): Promise<SurveyDetail | null> {
  const workspaceId = await requireWorkspace();
  const [survey] = await db
    .select()
    .from(schema.surveys)
    .where(
      and(
        eq(schema.surveys.id, id),
        eq(schema.surveys.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!survey) return null;

  const [stats] = await db
    .select({
      totalResponses: sql<number>`(SELECT COUNT(*) FROM responses WHERE survey_id = ${id} AND superseded_by IS NULL)`,
      avgRating: sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE survey_id = ${id} AND superseded_by IS NULL)`,
      lastResponseAt: sql<number | null>`(SELECT MAX(responded_at) FROM responses WHERE survey_id = ${id} AND superseded_by IS NULL)`,
    })
    .from(schema.surveys)
    .limit(1);

  return {
    ...survey,
    stats: {
      totalResponses: Number(stats?.totalResponses ?? 0),
      avgRating: stats?.avgRating != null ? Number(stats.avgRating) : null,
      lastResponseAt:
        stats?.lastResponseAt != null
          ? new Date(Number(stats.lastResponseAt))
          : null,
    },
  };
}

export async function getSurveyResponses(
  surveyId: string,
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
      ticketExternalId: schema.tickets.externalId,
      customerId: schema.customers.id,
      customerName: schema.customers.name,
      customerOrganization: schema.customers.organization,
      teamMemberId: schema.teamMembers.id,
      teamMemberName: schema.teamMembers.name,
      teamMemberAvatarColor: schema.teamMembers.avatarColor,
    })
    .from(schema.responses)
    .leftJoin(schema.tickets, eq(schema.tickets.id, schema.responses.ticketId))
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
        eq(schema.responses.surveyId, surveyId),
        eq(schema.responses.workspaceId, workspaceId),
        liveResponsesFilter(),
      ),
    )
    .orderBy(...groupOrderBy, desc(schema.responses.respondedAt))
    .limit(limit);
}
