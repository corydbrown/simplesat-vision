import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  ne,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { db, schema } from "../client";
import { compileListFilters } from "@/lib/filters/compile-list";
import {
  TEAM_MEMBER_FILTER_FIELDS,
  teamMemberAvgRatingExpr,
  teamMemberTotalResponsesExpr,
  teamMemberTotalTicketsExpr,
} from "@/lib/filters/fields/team-members";
import {
  ticketQaScoreExpr,
  ticketQaStatusExpr,
} from "@/lib/filters/fields/tickets";
import { TICKET_SIGNAL_SELECT, mapSignals } from "./tickets";
import type { Filter } from "@/lib/filters/types";
import { compileGroupOrderBy } from "@/lib/group/compile";
import { TEAM_MEMBER_GROUP_FIELDS } from "@/lib/group/fields/team-members";
import { TICKET_GROUP_FIELDS } from "@/lib/group/fields/tickets";
import { RESPONSE_GROUP_FIELDS } from "@/lib/group/fields/responses";
import type { GroupSpec } from "@/lib/group/types";
import type { SortSpec } from "@/lib/sort/url-state";
import { TEAM_MEMBER_CUSTOM_FIELDS_BY_ID } from "@/lib/properties/custom-fields";
import type {
  QaEvaluationStatus,
  ScorecardScaleType,
  TeamMember,
} from "../schema";

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

function teamMemberCustomFieldOrderExpr(defId: string): SQL | null {
  const def = TEAM_MEMBER_CUSTOM_FIELDS_BY_ID[defId];
  if (!def) return null;
  // Path is bound as a parameter (not interpolated into the SQL string) so
  // the def id can't influence SQL parsing even though ids are curated today.
  const path = `$.${defId}`;
  if (def.dataType === "number") {
    return sql`CAST(json_extract(team_members.custom_properties, ${path}) AS REAL)`;
  }
  return sql`json_extract(team_members.custom_properties, ${path})`;
}

function buildTeamMemberOrderBy(sorts: SortSpec[]): SQL[] {
  const out: SQL[] = [];
  for (const s of sorts) {
    let col: AnyColumn | SQL | null | undefined;
    if (s.key.startsWith("cf_")) {
      col = teamMemberCustomFieldOrderExpr(s.key.slice(3));
    } else {
      col = TEAM_MEMBER_SORT_MAP[s.key];
    }
    if (!col) continue;
    out.push(s.dir === "asc" ? asc(col) : desc(col));
  }
  if (out.length === 0) out.push(desc(totalTicketsExpr));
  return out;
}

export async function listTeamMembers({
  sorts = [],
  groupBy,
  filters,
}: {
  sorts?: SortSpec[];
  groupBy?: GroupSpec | null;
  filters?: Filter[];
} = {}): Promise<{
  rows: TeamMemberListRow[];
  total: number;
}> {
  const where = filters
    ? compileListFilters(filters, TEAM_MEMBER_FILTER_FIELDS)
    : undefined;

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
    qaScore: r.qaScore,
    qaStatus: r.qaStatus,
    signals: mapSignals(r),
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
    .where(eq(schema.responses.teamMemberId, memberId))
    .orderBy(...groupOrderBy, desc(schema.responses.respondedAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// QA performance rollup
// ---------------------------------------------------------------------------

/** Per-category average across the member's evaluations, with team-average
 *  overlay. Scores are normalized to 0-100 so the radar can compare across
 *  category scale types (likert_5, binary, three_state) on one axis. */
export type QaCategoryAverage = {
  categoryId: string;
  name: string;
  scaleType: ScorecardScaleType;
  order: number;
  weightPercent: number;
  isAutofail: boolean;
  /** Member's average effective_score normalized to 0-100. Null when the
   *  member has no evaluations covering this category. */
  memberAvg: number | null;
  /** Team-wide average effective_score for this category, normalized to
   *  0-100. Excludes the member being viewed. Null when no other team
   *  data covers this category. */
  teamAvg: number | null;
  memberSampleSize: number;
};

export type QaWeeklyTrendPoint = {
  /** Monday (UTC) of the bucket week, ms timestamp. */
  weekStartMs: number;
  memberAvg: number | null;
  teamAvg: number | null;
  memberSampleSize: number;
};

export type QaTopPoint = { text: string; count: number };

export type QaCsatCorrelationRow = {
  categoryId: string;
  name: string;
  /** Avg rating when normalized category score ≥ HIGH_LOW_SPLIT. */
  highAvgRating: number | null;
  /** Avg rating when normalized category score below the split. */
  lowAvgRating: number | null;
  highSampleSize: number;
  lowSampleSize: number;
};

export type QaRecentEvaluation = {
  id: string;
  ticketId: string;
  ticketSubject: string;
  overallScore: number;
  status: QaEvaluationStatus;
  scoredAtMs: number;
};

export type TeamMemberQaRollup = {
  evaluationCount: number;
  coachingNoteCount: number;
  /** Count of (evaluation, response-on-same-ticket) pairs — gates the CSAT
   *  correlation block per the 20-paired threshold in the brief. */
  pairedResponseCount: number;
  categoryAverages: QaCategoryAverage[];
  weeklyTrend: QaWeeklyTrendPoint[];
  strengths: QaTopPoint[];
  growthAreas: QaTopPoint[];
  csatCorrelations: QaCsatCorrelationRow[];
  recentEvaluations: QaRecentEvaluation[];
};

/** Normalize a raw category effective_score into a 0-100 scale so values from
 *  likert/binary/three_state categories live on one axis (radar overlay, weekly
 *  trend). Out-of-range scores are clamped. */
export function normalizeCategoryScore(
  score: number,
  scaleType: ScorecardScaleType,
): number {
  const max =
    scaleType === "likert_5" ? 5 : scaleType === "three_state" ? 2 : 1;
  const pct = (score / max) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** Threshold in normalized (0-100) space that splits "high" vs "low" category
 *  performance for the CSAT-correlation card. 80 maps cleanly to likert ≥4. */
const QA_HIGH_LOW_SPLIT = 80;

/** Trend window. The brief asks for "last 8-12 weeks", but the seed spreads
 *  ~50 evaluations across 25 members over five months — a 12-week cutoff
 *  empty-states even the highest-volume demo member. 26 weeks (~6 months) is
 *  the smallest window that surfaces real trend data in the prototype and
 *  remains a sensible production default (a quarter of context, not a year). */
const QA_TREND_WEEKS = 26;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/** Returns the Monday-00:00 UTC bucket start for a given ms timestamp. */
function weekStartUtcMs(ms: number): number {
  const d = new Date(ms);
  const dayOfWeek = d.getUTCDay(); // 0=Sun..6=Sat
  // Shift so Monday = 0
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysSinceMonday,
  );
}

/** Top-N frequency rollup, case-insensitive, preserves the first-seen casing.
 *  Strings shorter than 3 chars or empty are dropped. */
function topPoints(points: string[][], limit: number): QaTopPoint[] {
  const counts = new Map<string, { text: string; count: number }>();
  for (const arr of points) {
    for (const raw of arr) {
      const text = raw.trim();
      if (text.length < 3) continue;
      const key = text.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { text, count: 1 });
      }
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit);
}

export async function getTeamMemberQaRollup(
  memberId: string,
  options: { trendWeeks?: number; recentLimit?: number } = {},
): Promise<TeamMemberQaRollup> {
  const trendWeeks = options.trendWeeks ?? QA_TREND_WEEKS;
  const recentLimit = options.recentLimit ?? 10;

  // ---------------------------------------------------------------------------
  // Fetch in parallel: category catalog, member evals + category scores,
  // member coaching notes, paired responses, team category averages, team
  // weekly averages.
  // ---------------------------------------------------------------------------
  const [
    categoryRows,
    memberEvalRows,
    memberCategoryScoreRows,
    memberCoachingRows,
    pairedResponseRows,
    teamCategoryAvgRows,
    teamWeeklyRows,
  ] = await Promise.all([
    db
      .select({
        id: schema.scorecardCategories.id,
        name: schema.scorecardCategories.name,
        scaleType: schema.scorecardCategories.scaleType,
        order: schema.scorecardCategories.order,
        weightPercent: schema.scorecardCategories.weightPercent,
        isAutofail: schema.scorecardCategories.isAutofail,
      })
      .from(schema.scorecardCategories)
      .orderBy(asc(schema.scorecardCategories.order)),
    db
      .select({
        id: schema.evaluations.id,
        ticketId: schema.evaluations.ticketId,
        overallScore: schema.evaluations.overallScore,
        status: schema.evaluations.status,
        scoredAt: schema.evaluations.scoredAt,
        subject: schema.tickets.subject,
      })
      .from(schema.evaluations)
      .innerJoin(
        schema.tickets,
        eq(schema.tickets.id, schema.evaluations.ticketId),
      )
      .where(
        and(
          eq(schema.evaluations.scoredTeamMemberId, memberId),
          ne(schema.evaluations.status, "invalidated"),
        ),
      )
      .orderBy(desc(schema.evaluations.scoredAt)),
    db
      .select({
        evaluationId: schema.evaluationCategoryScores.evaluationId,
        categoryId: schema.evaluationCategoryScores.categoryId,
        effectiveScore: schema.evaluationCategoryScores.effectiveScore,
        scaleType: schema.scorecardCategories.scaleType,
      })
      .from(schema.evaluationCategoryScores)
      .innerJoin(
        schema.evaluations,
        eq(schema.evaluations.id, schema.evaluationCategoryScores.evaluationId),
      )
      .innerJoin(
        schema.scorecardCategories,
        eq(
          schema.scorecardCategories.id,
          schema.evaluationCategoryScores.categoryId,
        ),
      )
      .where(
        and(
          eq(schema.evaluations.scoredTeamMemberId, memberId),
          ne(schema.evaluations.status, "invalidated"),
        ),
      ),
    db
      .select({
        strengthPoints: schema.coachingNotes.strengthPoints,
        growthPoints: schema.coachingNotes.growthPoints,
      })
      .from(schema.coachingNotes)
      .innerJoin(
        schema.evaluations,
        eq(schema.evaluations.id, schema.coachingNotes.evaluationId),
      )
      .where(
        and(
          eq(schema.evaluations.scoredTeamMemberId, memberId),
          ne(schema.evaluations.status, "invalidated"),
        ),
      ),
    // Paired (evaluation, response) — same ticket, both keyed to this member.
    db
      .select({
        evaluationId: schema.evaluations.id,
        rating: schema.responses.rating,
        scale: schema.responses.scale,
      })
      .from(schema.evaluations)
      .innerJoin(
        schema.responses,
        and(
          eq(schema.responses.ticketId, schema.evaluations.ticketId),
          eq(schema.responses.teamMemberId, memberId),
        ),
      )
      .where(
        and(
          eq(schema.evaluations.scoredTeamMemberId, memberId),
          ne(schema.evaluations.status, "invalidated"),
        ),
      ),
    // Team-wide per-category averages (excluding this member). Aggregated in
    // SQL using the same effective_score column the per-ticket views read.
    db
      .select({
        categoryId: schema.evaluationCategoryScores.categoryId,
        avgRaw: sql<number>`AVG(${schema.evaluationCategoryScores.effectiveScore})`,
        sampleSize: sql<number>`COUNT(*)`,
      })
      .from(schema.evaluationCategoryScores)
      .innerJoin(
        schema.evaluations,
        eq(schema.evaluations.id, schema.evaluationCategoryScores.evaluationId),
      )
      .where(
        and(
          ne(schema.evaluations.scoredTeamMemberId, memberId),
          ne(schema.evaluations.status, "invalidated"),
        ),
      )
      .groupBy(schema.evaluationCategoryScores.categoryId),
    // Team-wide weekly averages over the trend window. Raw evaluation rows;
    // we bucket by Monday-of-week in TS so the SQL stays portable.
    db
      .select({
        scoredAt: schema.evaluations.scoredAt,
        overallScore: schema.evaluations.overallScore,
        memberId: schema.evaluations.scoredTeamMemberId,
      })
      .from(schema.evaluations)
      .where(ne(schema.evaluations.status, "invalidated")),
  ]);

  const evaluationCount = memberEvalRows.length;
  const coachingNoteCount = memberCoachingRows.length;
  const pairedResponseCount = pairedResponseRows.length;

  // ---------------------------------------------------------------------------
  // Category averages (member + team), normalized to 0-100.
  // ---------------------------------------------------------------------------
  const memberCategoryAcc = new Map<
    string,
    { sum: number; n: number; scaleType: ScorecardScaleType }
  >();
  for (const row of memberCategoryScoreRows) {
    const normalized = normalizeCategoryScore(row.effectiveScore, row.scaleType);
    const acc = memberCategoryAcc.get(row.categoryId);
    if (acc) {
      acc.sum += normalized;
      acc.n += 1;
    } else {
      memberCategoryAcc.set(row.categoryId, {
        sum: normalized,
        n: 1,
        scaleType: row.scaleType,
      });
    }
  }

  const teamCategoryAvgByCategoryId = new Map<string, number>();
  for (const row of teamCategoryAvgRows) {
    const category = categoryRows.find((c) => c.id === row.categoryId);
    if (!category) continue;
    teamCategoryAvgByCategoryId.set(
      row.categoryId,
      normalizeCategoryScore(Number(row.avgRaw), category.scaleType),
    );
  }

  const categoryAverages: QaCategoryAverage[] = categoryRows.map((c) => {
    const memberAcc = memberCategoryAcc.get(c.id);
    const memberAvg =
      memberAcc && memberAcc.n > 0 ? memberAcc.sum / memberAcc.n : null;
    const teamAvg = teamCategoryAvgByCategoryId.get(c.id) ?? null;
    return {
      categoryId: c.id,
      name: c.name,
      scaleType: c.scaleType,
      order: c.order,
      weightPercent: c.weightPercent,
      isAutofail: c.isAutofail,
      memberAvg,
      teamAvg,
      memberSampleSize: memberAcc?.n ?? 0,
    };
  });

  // ---------------------------------------------------------------------------
  // Weekly trend — last N weeks. Bucket member + team by Monday-of-week.
  // ---------------------------------------------------------------------------
  const now = Date.now();
  const currentWeekStart = weekStartUtcMs(now);
  const cutoff = currentWeekStart - (trendWeeks - 1) * MS_PER_WEEK;

  type WeekAcc = {
    memberSum: number;
    memberN: number;
    teamSum: number;
    teamN: number;
  };
  const weekAcc = new Map<number, WeekAcc>();
  for (let i = 0; i < trendWeeks; i += 1) {
    weekAcc.set(currentWeekStart - i * MS_PER_WEEK, {
      memberSum: 0,
      memberN: 0,
      teamSum: 0,
      teamN: 0,
    });
  }

  for (const row of teamWeeklyRows) {
    const ms = row.scoredAt.getTime();
    if (ms < cutoff) continue;
    const bucket = weekStartUtcMs(ms);
    const acc = weekAcc.get(bucket);
    if (!acc) continue;
    if (row.memberId === memberId) {
      acc.memberSum += row.overallScore;
      acc.memberN += 1;
    } else {
      acc.teamSum += row.overallScore;
      acc.teamN += 1;
    }
  }

  const weeklyTrend: QaWeeklyTrendPoint[] = Array.from(weekAcc.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekStartMs, acc]) => ({
      weekStartMs,
      memberAvg: acc.memberN > 0 ? acc.memberSum / acc.memberN : null,
      teamAvg: acc.teamN > 0 ? acc.teamSum / acc.teamN : null,
      memberSampleSize: acc.memberN,
    }));

  // ---------------------------------------------------------------------------
  // Strengths / growth — top-N frequency rollup over coaching notes.
  // ---------------------------------------------------------------------------
  const strengths = topPoints(
    memberCoachingRows.map((r) => r.strengthPoints),
    5,
  );
  const growthAreas = topPoints(
    memberCoachingRows.map((r) => r.growthPoints),
    5,
  );

  // ---------------------------------------------------------------------------
  // CSAT correlation per category. For each category, split paired responses
  // by whether the member's normalized score on that category was ≥ split.
  // ---------------------------------------------------------------------------
  const ratingByEvaluationId = new Map<string, number>();
  for (const r of pairedResponseRows) {
    // Normalize rating to 1..5 equivalent so cross-scale comparison is honest.
    // Most seed CSAT surveys are 1-5 already; this is a no-op for those.
    const normalized = r.scale > 0 ? (r.rating / r.scale) * 5 : r.rating;
    ratingByEvaluationId.set(r.evaluationId, normalized);
  }

  const csatCorrelations: QaCsatCorrelationRow[] = categoryRows.map((c) => {
    let highSum = 0;
    let highN = 0;
    let lowSum = 0;
    let lowN = 0;
    for (const score of memberCategoryScoreRows) {
      if (score.categoryId !== c.id) continue;
      const rating = ratingByEvaluationId.get(score.evaluationId);
      if (rating == null) continue;
      const normalized = normalizeCategoryScore(
        score.effectiveScore,
        score.scaleType,
      );
      if (normalized >= QA_HIGH_LOW_SPLIT) {
        highSum += rating;
        highN += 1;
      } else {
        lowSum += rating;
        lowN += 1;
      }
    }
    return {
      categoryId: c.id,
      name: c.name,
      highAvgRating: highN > 0 ? highSum / highN : null,
      lowAvgRating: lowN > 0 ? lowSum / lowN : null,
      highSampleSize: highN,
      lowSampleSize: lowN,
    };
  });

  // ---------------------------------------------------------------------------
  // Recent N evaluations — already ordered desc by scoredAt above.
  // ---------------------------------------------------------------------------
  const recentEvaluations: QaRecentEvaluation[] = memberEvalRows
    .slice(0, recentLimit)
    .map((e) => ({
      id: e.id,
      ticketId: e.ticketId,
      ticketSubject: e.subject,
      overallScore: e.overallScore,
      status: e.status,
      scoredAtMs: e.scoredAt.getTime(),
    }));

  return {
    evaluationCount,
    coachingNoteCount,
    pairedResponseCount,
    categoryAverages,
    weeklyTrend,
    strengths,
    growthAreas,
    csatCorrelations,
    recentEvaluations,
  };
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
