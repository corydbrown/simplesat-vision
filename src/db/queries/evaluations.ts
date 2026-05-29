import "server-only";
import { and, asc, desc, eq, type AnyColumn, type SQL } from "drizzle-orm";
import { db, schema } from "../client";
import { requireWorkspace } from "@/lib/workspace";
import { compileListFilters } from "@/lib/filters/compile-list";
import {
  COACHING_FILTER_FIELDS,
  evaluationAutoFailedExpr,
  evaluationTicketSubjectExpr,
} from "@/lib/filters/fields/coaching";
import type { Filter } from "@/lib/filters/types";
import { compileGroupOrderBy } from "@/lib/group/compile";
import { COACHING_GROUP_FIELDS } from "@/lib/group/fields/coaching";
import type { GroupSpec } from "@/lib/group/types";
import type { SortSpec } from "@/lib/sort/url-state";
import type { Evaluation, QaEvaluationStatus } from "../schema";

export type EvaluationSortKey =
  | "overall_score"
  | "status"
  | "scored_at"
  | "edited_at"
  | "scored_team_member"
  | "scorecard"
  | "ticket_subject"
  | "ai_confidence";

/** Row shape consumed by the Coaching list page's EntityTable. Hydrates
 *  every directly-displayed relation (scored team member, scorecard, parent
 *  ticket) so the row renders without follow-up queries. */
export type EvaluationsRow = Evaluation & {
  scoredTeamMember: {
    id: string;
    name: string;
    avatarColor: string;
    team: string;
  } | null;
  scorecard: { id: string; name: string } | null;
  ticket: {
    id: string;
    subject: string;
    externalId: string | null;
  } | null;
  autoFailed: boolean;
};

const SORT_COLUMN_MAP: Record<EvaluationSortKey, AnyColumn | SQL> = {
  overall_score: schema.evaluations.overallScore,
  status: schema.evaluations.status,
  scored_at: schema.evaluations.scoredAt,
  edited_at: schema.evaluations.editedAt,
  scored_team_member: schema.teamMembers.name,
  // Sort by the versioned (snapshot) name so it matches what the UI displays.
  scorecard: schema.scorecardVersions.name,
  ticket_subject: evaluationTicketSubjectExpr,
  ai_confidence: schema.evaluations.aiConfidence,
};

function buildEvaluationOrderBy(sorts: SortSpec[]): SQL[] {
  const out: SQL[] = [];
  for (const s of sorts) {
    const col = SORT_COLUMN_MAP[s.key as EvaluationSortKey];
    if (!col) continue;
    out.push(s.dir === "asc" ? asc(col) : desc(col));
  }
  if (out.length === 0) out.push(desc(schema.evaluations.scoredAt));
  return out;
}

export async function listEvaluations({
  page,
  pageSize,
  sorts,
  filters,
  groupBy,
}: {
  page: number;
  pageSize: number;
  sorts: SortSpec[];
  filters?: Filter[];
  groupBy?: GroupSpec | null;
}): Promise<{ rows: EvaluationsRow[]; total: number }> {
  const workspaceId = await requireWorkspace();
  const orderByList = buildEvaluationOrderBy(sorts);
  const groupOrderBy = compileGroupOrderBy(
    groupBy ?? null,
    COACHING_GROUP_FIELDS,
  );
  const filterWhere = filters
    ? compileListFilters(filters, COACHING_FILTER_FIELDS)
    : undefined;
  const workspaceWhere = eq(schema.evaluations.workspaceId, workspaceId);
  const where = filterWhere ? and(workspaceWhere, filterWhere) : workspaceWhere;

  const offset = (page - 1) * pageSize;

  const baseQuery = db
    .select({
      evaluation: schema.evaluations,
      scoredTeamMember: {
        id: schema.teamMembers.id,
        name: schema.teamMembers.name,
        avatarColor: schema.teamMembers.avatarColor,
        team: schema.teamMembers.team,
      },
      scorecard: {
        id: schema.scorecards.id,
        // Snapshot name (versioned), so list rows and sidebar match the
        // version picker — every surface shows the rubric name as-of this
        // evaluation, not the current live name. A renamed scorecard won't
        // retroactively rebrand historical evals.
        name: schema.scorecardVersions.name,
      },
      ticket: {
        id: schema.tickets.id,
        subject: schema.tickets.subject,
        externalId: schema.tickets.externalId,
      },
      autoFailed: evaluationAutoFailedExpr,
    })
    .from(schema.evaluations)
    .leftJoin(
      schema.teamMembers,
      eq(schema.teamMembers.id, schema.evaluations.scoredTeamMemberId),
    )
    .leftJoin(
      schema.scorecards,
      eq(schema.scorecards.id, schema.evaluations.scorecardId),
    )
    .leftJoin(
      schema.scorecardVersions,
      eq(schema.scorecardVersions.id, schema.evaluations.scorecardVersionId),
    )
    .leftJoin(
      schema.tickets,
      eq(schema.tickets.id, schema.evaluations.ticketId),
    );

  const [rawRows, total] = await Promise.all([
    baseQuery
      .where(where)
      .orderBy(...groupOrderBy, ...orderByList)
      .limit(pageSize)
      .offset(offset),
    db.$count(schema.evaluations, where),
  ]);

  const rows: EvaluationsRow[] = rawRows.map((r) => ({
    ...r.evaluation,
    scoredTeamMember: r.scoredTeamMember?.id ? r.scoredTeamMember : null,
    scorecard:
      r.scorecard?.id && r.scorecard?.name
        ? { id: r.scorecard.id, name: r.scorecard.name }
        : null,
    ticket: r.ticket?.id ? r.ticket : null,
    autoFailed: r.autoFailed === 1,
  }));

  return { rows, total };
}

export type EvaluationSummary = {
  id: string;
  overallScore: number;
  status: QaEvaluationStatus;
  scoredAt: Date;
  editedAt: Date | null;
  scoredTeamMember: {
    id: string;
    name: string;
    avatarColor: string;
  } | null;
  scorecard: { id: string; name: string } | null;
  ticket: {
    id: string;
    subject: string;
    externalId: string | null;
  } | null;
  autoFailed: boolean;
};

export type EvaluationVersionRow = {
  id: string;
  scorecardVersion: number;
  /** Scorecard name as-of this evaluation's version (snapshot, not live).
   *  A renamed scorecard won't retroactively rebrand historical evals. */
  scorecardName: string;
  overallScore: number;
  scoredAt: Date;
  status: QaEvaluationStatus;
};

/** Returns every evaluation for a given ticket, ordered newest-version-first.
 *  Drives the version picker on the coaching detail page — when the scorecard
 *  is edited + an eval is re-scored, multiple rows accumulate per ticket. */
export async function listEvaluationsForTicket(
  ticketId: string,
): Promise<EvaluationVersionRow[]> {
  const workspaceId = await requireWorkspace();
  const rows = await db
    .select({
      id: schema.evaluations.id,
      scorecardVersion: schema.scorecardVersions.version,
      scorecardName: schema.scorecardVersions.name,
      overallScore: schema.evaluations.overallScore,
      scoredAt: schema.evaluations.scoredAt,
      status: schema.evaluations.status,
    })
    .from(schema.evaluations)
    .innerJoin(
      schema.scorecardVersions,
      eq(
        schema.scorecardVersions.id,
        schema.evaluations.scorecardVersionId,
      ),
    )
    .where(
      and(
        eq(schema.evaluations.ticketId, ticketId),
        eq(schema.evaluations.workspaceId, workspaceId),
      ),
    )
    .orderBy(
      desc(schema.scorecardVersions.version),
      desc(schema.evaluations.scoredAt),
    );
  return rows;
}

/** Minimal evaluation lookup for the placeholder detail route. The rich
 *  category + coaching breakdown lands in Batch 2 — for now we only need
 *  enough to render the placeholder summary card. */
export async function getEvaluationById(
  id: string,
): Promise<EvaluationSummary | null> {
  const workspaceId = await requireWorkspace();
  const [r] = await db
    .select({
      evaluation: schema.evaluations,
      scoredTeamMember: {
        id: schema.teamMembers.id,
        name: schema.teamMembers.name,
        avatarColor: schema.teamMembers.avatarColor,
      },
      scorecard: {
        id: schema.scorecards.id,
        // Snapshot name (versioned), so list rows and sidebar match the
        // version picker — every surface shows the rubric name as-of this
        // evaluation, not the current live name. A renamed scorecard won't
        // retroactively rebrand historical evals.
        name: schema.scorecardVersions.name,
      },
      ticket: {
        id: schema.tickets.id,
        subject: schema.tickets.subject,
        externalId: schema.tickets.externalId,
      },
      autoFailed: evaluationAutoFailedExpr,
    })
    .from(schema.evaluations)
    .leftJoin(
      schema.teamMembers,
      eq(schema.teamMembers.id, schema.evaluations.scoredTeamMemberId),
    )
    .leftJoin(
      schema.scorecards,
      eq(schema.scorecards.id, schema.evaluations.scorecardId),
    )
    .leftJoin(
      schema.scorecardVersions,
      eq(schema.scorecardVersions.id, schema.evaluations.scorecardVersionId),
    )
    .leftJoin(
      schema.tickets,
      eq(schema.tickets.id, schema.evaluations.ticketId),
    )
    .where(
      and(
        eq(schema.evaluations.id, id),
        eq(schema.evaluations.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!r) return null;

  return {
    id: r.evaluation.id,
    overallScore: r.evaluation.overallScore,
    status: r.evaluation.status,
    scoredAt: r.evaluation.scoredAt,
    editedAt: r.evaluation.editedAt,
    scoredTeamMember: r.scoredTeamMember?.id ? r.scoredTeamMember : null,
    scorecard:
      r.scorecard?.id && r.scorecard?.name
        ? { id: r.scorecard.id, name: r.scorecard.name }
        : null,
    ticket: r.ticket?.id ? r.ticket : null,
    autoFailed: r.autoFailed === 1,
  };
}
