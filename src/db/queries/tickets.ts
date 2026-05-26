import "server-only";
import { and, asc, desc, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db, schema } from "../client";
import { compileListFilters } from "@/lib/filters/compile-list";
import {
  TICKET_FILTER_FIELDS,
  ticketAiHandoffExpr,
  ticketCustomerReplyCountExpr,
  ticketEscalatedExpr,
  ticketHadTransferExpr,
  ticketLongestIdleHoursExpr,
  ticketQaScoreExpr,
  ticketQaStatusExpr,
  ticketQueueWaitHoursExpr,
  ticketReassignmentCountExpr,
  ticketSlaBreachedExpr,
} from "@/lib/filters/fields/tickets";
import type { Filter } from "@/lib/filters/types";
import { compileGroupOrderBy } from "@/lib/group/compile";
import { TICKET_GROUP_FIELDS } from "@/lib/group/fields/tickets";
import type { GroupSpec } from "@/lib/group/types";
import type { SortSpec } from "@/lib/sort/url-state";
import { resolveScorer, type QaScorerView } from "@/lib/qa/scorer";
import type {
  QaEvaluationStatus,
  ScorecardScaleType,
  Ticket,
  TicketMessageAuthorRole,
  TicketMessageChannel,
  TicketMessageType,
  TicketEventVerb,
} from "../schema";

export type TicketSortKey =
  | "subject"
  | "status"
  | "priority"
  | "channel"
  | "created_at"
  | "closed_at"
  | "solved_at"
  | "first_response_at"
  | "helpdesk"
  | "external_id"
  | "internal_id"
  | "customer"
  | "company"
  | "assignee"
  | "response"
  | "resolution_time"
  | "survey_state"
  | "qa_score";

export type TicketsRow = Ticket & {
  customer: { id: string; name: string; company: string | null } | null;
  assignee: {
    id: string;
    name: string;
    avatarColor: string;
    team: string;
  } | null;
  response: {
    id: string;
    rating: number;
    scale: number;
    comment: string | null;
  } | null;
  qaScore: number | null;
  qaStatus: QaEvaluationStatus | null;
  signals: TicketSignals;
};

/** Per-row truth-set of the seven ticket-event signals. Boolean signals come
 *  back from SQLite as 0/1 from EXISTS; we coerce to true booleans at the
 *  query boundary so cells/filters consume them as JS booleans. */
export type TicketSignals = {
  hadTransfer: boolean;
  reassignmentCount: number;
  queueWaitHours: number | null;
  slaBreached: boolean;
  escalated: boolean;
  aiHandoff: boolean;
  customerReplyCount: number;
  longestIdleHours: number | null;
};

export function mapSignals(raw: {
  hadTransfer: number | null;
  reassignmentCount: number | null;
  queueWaitHours: number | null;
  slaBreached: number | null;
  escalated: number | null;
  aiHandoff: number | null;
  customerReplyCount: number | null;
  longestIdleHours: number | null;
}): TicketSignals {
  return {
    hadTransfer: raw.hadTransfer === 1,
    reassignmentCount: raw.reassignmentCount ?? 0,
    queueWaitHours: raw.queueWaitHours,
    slaBreached: raw.slaBreached === 1,
    escalated: raw.escalated === 1,
    aiHandoff: raw.aiHandoff === 1,
    customerReplyCount: raw.customerReplyCount ?? 0,
    longestIdleHours: raw.longestIdleHours,
  };
}

/** SELECT clause snippet that loads all seven signal expressions onto a
 *  TicketsRow query. Shared by listTickets, getTicketById, and the customer/
 *  team-member ticket lists so they all surface the same signal data. */
export const TICKET_SIGNAL_SELECT = {
  hadTransfer: ticketHadTransferExpr,
  reassignmentCount: ticketReassignmentCountExpr,
  queueWaitHours: ticketQueueWaitHoursExpr,
  slaBreached: ticketSlaBreachedExpr,
  escalated: ticketEscalatedExpr,
  aiHandoff: ticketAiHandoffExpr,
  customerReplyCount: ticketCustomerReplyCountExpr,
  longestIdleHours: ticketLongestIdleHoursExpr,
} as const;

// Server-side ORDER BY references. Resolution time and survey state are
// computed via SQL expressions; survey_state must mirror the client-side
// ordering in lib/properties/tickets.tsx so client- and server-sorted
// surfaces agree.
const SORT_COLUMN_MAP: Record<TicketSortKey, AnyColumn | SQL> = {
  subject: schema.tickets.subject,
  status: schema.tickets.status,
  priority: schema.tickets.priority,
  channel: schema.tickets.channel,
  created_at: schema.tickets.createdAt,
  closed_at: schema.tickets.closedAt,
  solved_at: schema.tickets.solvedAt,
  first_response_at: schema.tickets.firstResponseAt,
  helpdesk: schema.tickets.helpdesk,
  external_id: schema.tickets.helpdeskExternalId,
  internal_id: schema.tickets.id,
  customer: schema.customers.name,
  company: schema.customers.company,
  assignee: schema.teamMembers.name,
  response: schema.responses.rating,
  resolution_time: sql<number | null>`(tickets.solved_at - tickets.created_at)`,
  survey_state: sql<number>`(CASE
    WHEN responses.id IS NOT NULL THEN 1
    WHEN tickets.survey_sent_at IS NOT NULL THEN 2
    WHEN tickets.survey_not_sent_reason IS NOT NULL THEN 3
    WHEN tickets.survey_eligible = 0 THEN 4
    ELSE 5
  END)`,
  qa_score: ticketQaScoreExpr,
};

function buildTicketOrderBy(sorts: SortSpec[]): SQL[] {
  const out: SQL[] = [];
  for (const s of sorts) {
    const col = SORT_COLUMN_MAP[s.key as TicketSortKey];
    if (!col) continue;
    out.push(s.dir === "asc" ? asc(col) : desc(col));
  }
  if (out.length === 0) out.push(desc(schema.tickets.closedAt));
  return out;
}

export async function listTickets({
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
}): Promise<{ rows: TicketsRow[]; total: number }> {
  const orderByList = buildTicketOrderBy(sorts);
  const groupOrderBy = compileGroupOrderBy(groupBy ?? null, TICKET_GROUP_FIELDS);
  const where = filters
    ? compileListFilters(filters, TICKET_FILTER_FIELDS)
    : undefined;

  const offset = (page - 1) * pageSize;

  const baseQuery = db
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
    );

  const [rawRows, total] = await Promise.all([
    (where ? baseQuery.where(where) : baseQuery)
      .orderBy(...groupOrderBy, ...orderByList)
      .limit(pageSize)
      .offset(offset),
    db.$count(schema.tickets, where),
  ]);

  const rows: TicketsRow[] = rawRows.map((r) => ({
    ...r.ticket,
    customer: r.customer?.id ? r.customer : null,
    assignee: r.assignee?.id ? r.assignee : null,
    response: r.response?.id ? r.response : null,
    qaScore: r.qaScore,
    qaStatus: r.qaStatus,
    signals: mapSignals(r),
  }));

  return { rows, total };
}

export type TicketMessageView = {
  id: string;
  authorRole: TicketMessageAuthorRole;
  channel: TicketMessageChannel;
  isPublic: boolean;
  type: TicketMessageType;
  body: string;
  createdAt: Date;
  customer: { id: string; name: string } | null;
  teamMember: {
    id: string;
    name: string;
    avatarColor: string;
  } | null;
};

export type TicketEventView = {
  id: string;
  verb: TicketEventVerb;
  fieldName: string | null;
  previousValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  actorRole: TicketMessageAuthorRole;
  actor:
    | { kind: "customer"; id: string; name: string }
    | { kind: "agent"; id: string; name: string; avatarColor: string }
    | { kind: "system" };
};

export type QaCategoryView = {
  categoryId: string;
  name: string;
  description: string;
  weightPercent: number;
  scaleType: ScorecardScaleType;
  order: number;
  isAutofail: boolean;
  aiScore: number;
  humanScore: number | null;
  humanScoreReason: string | null;
  effectiveScore: number;
  aiReasoning: string;
  highlightedMessageIds: string[];
};

export type QaEditorView = {
  id: string;
  name: string;
  avatarColor: string;
};

export type QaCoachingView = {
  strengthPoints: string[];
  growthPoints: string[];
  exampleMessageIds: string[];
};

export type QaEvaluationView = {
  id: string;
  ticketId: string;
  scorecardId: string;
  scorecardName: string;
  scorecardVersion: number;
  overallScore: number;
  status: QaEvaluationStatus;
  /** Provider's self-reported confidence, 0-100 (integer percent, as stored). */
  aiConfidence: number;
  aiReasoningSummary: string;
  scoredAt: Date;
  invalidatedReason: string | null;
  scorer: QaScorerView;
  /** Manager who last applied an inline edit. Null until status flips to
   *  `edited` / `finalized`. */
  editor: QaEditorView | null;
  /** Wall-clock of the most recent inline edit; pairs with `editor`. */
  editedAt: Date | null;
  categories: QaCategoryView[];
  coaching: QaCoachingView | null;
};

export type TicketDetail = TicketsRow & {
  messages: TicketMessageView[];
  events: TicketEventView[];
  evaluation: QaEvaluationView | null;
};

export async function getTicketById(id: string): Promise<TicketDetail | null> {
  const [r] = await db
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
    .where(eq(schema.tickets.id, id))
    .limit(1);

  if (!r) return null;

  const [messageRows, eventRows, evaluationRows] = await Promise.all([
    db
      .select({
        message: schema.ticketMessages,
        customer: {
          id: schema.customers.id,
          name: schema.customers.name,
        },
        teamMember: {
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          avatarColor: schema.teamMembers.avatarColor,
        },
      })
      .from(schema.ticketMessages)
      .leftJoin(
        schema.customers,
        eq(schema.customers.id, schema.ticketMessages.customerId),
      )
      .leftJoin(
        schema.teamMembers,
        eq(schema.teamMembers.id, schema.ticketMessages.teamMemberId),
      )
      .where(eq(schema.ticketMessages.ticketId, id))
      .orderBy(asc(schema.ticketMessages.createdAt)),
    db
      .select({
        event: schema.ticketEvents,
        customer: {
          id: schema.customers.id,
          name: schema.customers.name,
        },
        teamMember: {
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          avatarColor: schema.teamMembers.avatarColor,
        },
      })
      .from(schema.ticketEvents)
      .leftJoin(
        schema.customers,
        eq(schema.customers.id, schema.ticketEvents.actorCustomerId),
      )
      .leftJoin(
        schema.teamMembers,
        eq(schema.teamMembers.id, schema.ticketEvents.actorTeamMemberId),
      )
      .where(eq(schema.ticketEvents.ticketId, id))
      .orderBy(asc(schema.ticketEvents.createdAt)),
    // Latest evaluation + category breakdown + coaching notes for the QA
    // drawer/detail sections. Only one evaluation per ticket today, but
    // order desc by scoredAt so a future re-score history doesn't surface
    // the wrong row.
    //
    // The coachingNotes left-join duplicates the same coaching row across
    // each category row in the cartesian — that's fine, the mapping below
    // reads it once off the head row.
    db
      .select({
        evaluation: schema.evaluations,
        scorecard: {
          name: schema.scorecardVersions.name,
          version: schema.scorecardVersions.version,
        },
        category: {
          // Logical id (live scorecard_categories.id) — what the UI uses to
          // reference categories for highlight + edit server actions.
          id: schema.scorecardVersionCategories.sourceCategoryId,
          name: schema.scorecardVersionCategories.name,
          description: schema.scorecardVersionCategories.description,
          scaleType: schema.scorecardVersionCategories.scaleType,
          weightPercent: schema.scorecardVersionCategories.weightPercent,
          isAutofail: schema.scorecardVersionCategories.isAutofail,
          order: schema.scorecardVersionCategories.order,
        },
        categoryScore: {
          aiScore: schema.evaluationCategoryScores.aiScore,
          humanScore: schema.evaluationCategoryScores.humanScore,
          humanScoreReason: schema.evaluationCategoryScores.humanScoreReason,
          effectiveScore: schema.evaluationCategoryScores.effectiveScore,
          aiReasoning: schema.evaluationCategoryScores.aiReasoning,
          highlightedMessageIds:
            schema.evaluationCategoryScores.highlightedMessageIds,
        },
        editor: {
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          avatarColor: schema.teamMembers.avatarColor,
        },
        coaching: {
          strengthPoints: schema.coachingNotes.strengthPoints,
          growthPoints: schema.coachingNotes.growthPoints,
          exampleMessageIds: schema.coachingNotes.exampleMessageIds,
        },
      })
      .from(schema.evaluations)
      .innerJoin(
        schema.scorecardVersions,
        eq(
          schema.scorecardVersions.id,
          schema.evaluations.scorecardVersionId,
        ),
      )
      .innerJoin(
        schema.evaluationCategoryScores,
        eq(
          schema.evaluationCategoryScores.evaluationId,
          schema.evaluations.id,
        ),
      )
      .innerJoin(
        schema.scorecardVersionCategories,
        and(
          eq(
            schema.scorecardVersionCategories.scorecardVersionId,
            schema.evaluations.scorecardVersionId,
          ),
          eq(
            schema.scorecardVersionCategories.sourceCategoryId,
            schema.evaluationCategoryScores.categoryId,
          ),
        ),
      )
      .leftJoin(
        schema.coachingNotes,
        eq(schema.coachingNotes.evaluationId, schema.evaluations.id),
      )
      .leftJoin(
        schema.teamMembers,
        eq(schema.teamMembers.id, schema.evaluations.editedBy),
      )
      .where(eq(schema.evaluations.ticketId, id))
      .orderBy(
        desc(schema.evaluations.scoredAt),
        asc(schema.scorecardVersionCategories.order),
      ),
  ]);

  const messages: TicketMessageView[] = messageRows.map((m) => ({
    id: m.message.id,
    authorRole: m.message.authorRole,
    channel: m.message.channel,
    isPublic: m.message.isPublic,
    type: m.message.type,
    body: m.message.body,
    createdAt: m.message.createdAt,
    customer: m.customer?.id ? m.customer : null,
    teamMember: m.teamMember?.id ? m.teamMember : null,
  }));

  const events: TicketEventView[] = eventRows.map((e) => {
    const actor: TicketEventView["actor"] =
      e.event.actorRole === "customer" && e.customer?.id
        ? { kind: "customer", id: e.customer.id, name: e.customer.name }
        : e.event.actorRole === "agent" && e.teamMember?.id
          ? {
              kind: "agent",
              id: e.teamMember.id,
              name: e.teamMember.name,
              avatarColor: e.teamMember.avatarColor,
            }
          : { kind: "system" };
    return {
      id: e.event.id,
      verb: e.event.verb,
      fieldName: e.event.fieldName,
      previousValue: e.event.previousValue,
      newValue: e.event.newValue,
      metadata: e.event.metadata,
      createdAt: e.event.createdAt,
      actorRole: e.event.actorRole,
      actor,
    };
  });

  let evaluation: QaEvaluationView | null = null;
  if (evaluationRows.length > 0) {
    const headRow = evaluationRows[0];
    const head = headRow.evaluation;
    const headRows = evaluationRows.filter(
      (row) => row.evaluation.id === head.id,
    );
    const categories: QaCategoryView[] = headRows.map((row) => ({
      categoryId: row.category.id,
      name: row.category.name,
      description: row.category.description,
      weightPercent: row.category.weightPercent,
      scaleType: row.category.scaleType,
      order: row.category.order,
      isAutofail: row.category.isAutofail,
      aiScore: row.categoryScore.aiScore,
      humanScore: row.categoryScore.humanScore,
      humanScoreReason: row.categoryScore.humanScoreReason,
      effectiveScore: row.categoryScore.effectiveScore,
      aiReasoning: row.categoryScore.aiReasoning,
      highlightedMessageIds: row.categoryScore.highlightedMessageIds,
    }));
    // The coachingNotes left-join returns nulls when no coaching row exists.
    // strengthPoints/growthPoints/exampleMessageIds are NOT NULL on the table,
    // so any non-null on those fields means the join matched.
    const c = headRow.coaching;
    const coaching: QaCoachingView | null =
      c && c.strengthPoints != null
        ? {
            strengthPoints: c.strengthPoints,
            growthPoints: c.growthPoints ?? [],
            exampleMessageIds: c.exampleMessageIds ?? [],
          }
        : null;
    const editor =
      head.editedBy && headRow.editor?.id ? headRow.editor : null;
    evaluation = {
      id: head.id,
      ticketId: head.ticketId,
      scorecardId: head.scorecardId,
      scorecardName: headRow.scorecard?.name ?? "Scorecard",
      scorecardVersion: headRow.scorecard?.version ?? 1,
      overallScore: head.overallScore,
      status: head.status,
      aiConfidence: head.aiConfidence,
      aiReasoningSummary: head.aiReasoningSummary,
      scoredAt: head.scoredAt,
      invalidatedReason: head.invalidatedReason,
      scorer: resolveScorer(head.aiModel),
      editor,
      editedAt: head.editedAt,
      categories,
      coaching,
    };
  }

  return {
    ...r.ticket,
    customer: r.customer?.id ? r.customer : null,
    assignee: r.assignee?.id ? r.assignee : null,
    response: r.response?.id ? r.response : null,
    qaScore: r.qaScore,
    qaStatus: r.qaStatus,
    signals: mapSignals(r),
    messages,
    events,
    evaluation,
  };
}
