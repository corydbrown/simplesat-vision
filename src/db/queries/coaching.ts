import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../client";
import { requireWorkspace } from "@/lib/workspace";
import type {
  QaEvaluationStatus,
  ScorecardScaleType,
  TicketEventVerb,
  TicketMessageAuthorRole,
  TicketMessageChannel,
  TicketMessageType,
  TicketStatus,
} from "../schema";
import {
  getCommentProvider,
  type CommentRow,
  type ReactionRow,
} from "@/lib/qa/coaching";

export type CoachingMessageView = {
  id: string;
  authorRole: TicketMessageAuthorRole;
  authorName: string;
  authorId: string | null;
  authorAvatarColor: string | null;
  channel: TicketMessageChannel;
  isPublic: boolean;
  type: TicketMessageType;
  body: string;
  createdAt: number;
};

export type CoachingActivityView = {
  id: string;
  verb: TicketEventVerb;
  label: string;
  /** Message id this activity sits *after* on the timeline. Null when the
   *  activity happens before any messages (e.g. ticket_created). */
  afterMessageId: string | null;
  createdAt: number;
};

export type CoachingCategoryView = {
  id: string;
  name: string;
  description: string;
  scaleType: ScorecardScaleType;
  weightPercent: number;
  order: number;
  isAutofail: boolean;
  aiScore: number;
  humanScore: number | null;
  humanScoreReason: string | null;
  effectiveScore: number;
  aiReasoning: string;
  highlightedMessageIds: string[];
};

export type CoachingMemberView = {
  id: string;
  name: string;
  avatarColor: string;
  role: string;
};

export type CoachingEvaluationView = {
  id: string;
  overallScore: number;
  status: QaEvaluationStatus;
  aiConfidence: number;
  aiReasoningSummary: string;
  scoredAt: number;
  editedAt: number | null;
  autoFailed: boolean;
  scorecard: { id: string; name: string; version: number };
  scoredAgent: CoachingMemberView | null;
  editor: CoachingMemberView | null;
  categories: CoachingCategoryView[];
};

export type CoachingTicketView = {
  id: string;
  externalId: string | null;
  subject: string;
  status: TicketStatus;
  priority: "low" | "normal" | "high" | "urgent";
  channel: "email" | "chat" | "phone" | "social";
  customer: { id: string; name: string; tier: string | null } | null;
  assignee: CoachingMemberView | null;
};

export type CoachingDetail = {
  evaluation: CoachingEvaluationView;
  ticket: CoachingTicketView;
  messages: CoachingMessageView[];
  activities: CoachingActivityView[];
  comments: CommentRow[];
  reactions: ReactionRow[];
  /** Lookup table of every team member referenced by messages, comments,
   *  reactions, or the evaluation itself. UI uses this to render author
   *  names + avatar colors without follow-up queries. */
  membersById: Record<string, CoachingMemberView>;
  currentUserId: string;
};

/** Single read for the coaching detail page. Joins evaluation + scorecard +
 *  agent + ticket + customer in one select, then fetches messages, events,
 *  comments, and reactions in parallel. Returns null if the evaluation does
 *  not exist. */
export async function getCoachingDetail(
  evaluationId: string,
): Promise<CoachingDetail | null> {
  const workspaceId = await requireWorkspace();
  const [head] = await db
    .select({
      evaluation: schema.evaluations,
      scorecard: {
        id: schema.scorecards.id,
        name: schema.scorecardVersions.name,
        version: schema.scorecardVersions.version,
      },
      scoredAgent: {
        id: schema.teamMembers.id,
        name: schema.teamMembers.name,
        avatarColor: schema.teamMembers.avatarColor,
        role: schema.teamMembers.role,
      },
      ticket: {
        id: schema.tickets.id,
        externalId: schema.tickets.externalId,
        subject: schema.tickets.subject,
        status: schema.tickets.status,
        priority: schema.tickets.priority,
        channel: schema.tickets.channel,
        customerId: schema.tickets.customerId,
        teamMemberId: schema.tickets.teamMemberId,
      },
    })
    .from(schema.evaluations)
    .innerJoin(
      schema.scorecards,
      eq(schema.scorecards.id, schema.evaluations.scorecardId),
    )
    .innerJoin(
      schema.scorecardVersions,
      eq(
        schema.scorecardVersions.id,
        schema.evaluations.scorecardVersionId,
      ),
    )
    .leftJoin(
      schema.teamMembers,
      eq(schema.teamMembers.id, schema.evaluations.scoredTeamMemberId),
    )
    .leftJoin(
      schema.tickets,
      eq(schema.tickets.id, schema.evaluations.ticketId),
    )
    .where(
      and(
        eq(schema.evaluations.id, evaluationId),
        eq(schema.evaluations.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!head || !head.ticket) return null;

  const evaluation = head.evaluation;
  const ticketId = head.ticket.id;

  const customerPromise = head.ticket.customerId
    ? db
        .select({
          id: schema.customers.id,
          name: schema.customers.name,
          tier: schema.customers.tier,
        })
        .from(schema.customers)
        .where(eq(schema.customers.id, head.ticket.customerId))
        .limit(1)
    : Promise.resolve([]);

  const assigneePromise = head.ticket.teamMemberId
    ? db
        .select({
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          avatarColor: schema.teamMembers.avatarColor,
          role: schema.teamMembers.role,
        })
        .from(schema.teamMembers)
        .where(eq(schema.teamMembers.id, head.ticket.teamMemberId))
        .limit(1)
    : Promise.resolve([]);

  const editorPromise = evaluation.editedBy
    ? db
        .select({
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          avatarColor: schema.teamMembers.avatarColor,
          role: schema.teamMembers.role,
        })
        .from(schema.teamMembers)
        .where(eq(schema.teamMembers.id, evaluation.editedBy))
        .limit(1)
    : Promise.resolve([]);

  const provider = getCommentProvider();

  const [
    customerRows,
    assigneeRows,
    editorRows,
    messageRows,
    eventRows,
    categoryRows,
    comments,
    reactions,
    currentUserId,
  ] = await Promise.all([
    customerPromise,
    assigneePromise,
    editorPromise,
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
          role: schema.teamMembers.role,
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
      .where(eq(schema.ticketMessages.ticketId, ticketId))
      .orderBy(asc(schema.ticketMessages.createdAt)),
    db
      .select({
        event: schema.ticketEvents,
        actorMember: {
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          avatarColor: schema.teamMembers.avatarColor,
          role: schema.teamMembers.role,
        },
        actorCustomer: {
          id: schema.customers.id,
          name: schema.customers.name,
        },
      })
      .from(schema.ticketEvents)
      .leftJoin(
        schema.teamMembers,
        eq(schema.teamMembers.id, schema.ticketEvents.actorTeamMemberId),
      )
      .leftJoin(
        schema.customers,
        eq(schema.customers.id, schema.ticketEvents.actorCustomerId),
      )
      .where(eq(schema.ticketEvents.ticketId, ticketId))
      .orderBy(asc(schema.ticketEvents.createdAt)),
    db
      .select({
        category: schema.scorecardVersionCategories,
        score: schema.evaluationCategoryScores,
      })
      .from(schema.evaluationCategoryScores)
      .innerJoin(
        schema.scorecardVersionCategories,
        eq(
          schema.scorecardVersionCategories.sourceCategoryId,
          schema.evaluationCategoryScores.categoryId,
        ),
      )
      .where(
        and(
          eq(schema.evaluationCategoryScores.evaluationId, evaluation.id),
          eq(
            schema.scorecardVersionCategories.scorecardVersionId,
            evaluation.scorecardVersionId,
          ),
        ),
      )
      .orderBy(asc(schema.scorecardVersionCategories.order)),
    provider.listComments(evaluation.id),
    provider.listReactions(evaluation.id),
    resolveCurrentUserId(workspaceId),
  ]);

  const customer = customerRows[0] ?? null;
  const assignee = assigneeRows[0] ?? null;
  const editor = editorRows[0] ?? null;

  const messages: CoachingMessageView[] = messageRows.map((m) => ({
    id: m.message.id,
    authorRole: m.message.authorRole,
    authorName:
      m.message.authorRole === "customer" && m.customer?.name
        ? m.customer.name
        : m.message.authorRole === "agent" && m.teamMember?.name
          ? m.teamMember.name
          : "System",
    authorId:
      m.message.authorRole === "customer"
        ? (m.customer?.id ?? null)
        : m.message.authorRole === "agent"
          ? (m.teamMember?.id ?? null)
          : null,
    authorAvatarColor:
      m.message.authorRole === "agent" ? (m.teamMember?.avatarColor ?? null) : null,
    channel: m.message.channel,
    isPublic: m.message.isPublic,
    type: m.message.type,
    body: m.message.body,
    createdAt: m.message.createdAt.getTime(),
  }));

  // Activities anchor "after" the most-recently-created message at or before
  // the event's timestamp. Pre-compute that walk here so the UI just renders.
  const activities: CoachingActivityView[] = eventRows.map((e) => {
    const t = e.event.createdAt.getTime();
    let afterMessageId: string | null = null;
    for (const msg of messages) {
      if (msg.createdAt <= t) afterMessageId = msg.id;
      else break;
    }
    return {
      id: e.event.id,
      verb: e.event.verb,
      label: describeActivity(
        e.event.verb,
        e.event.previousValue,
        e.event.newValue,
        e.actorMember?.name ?? e.actorCustomer?.name ?? null,
      ),
      afterMessageId,
      createdAt: t,
    };
  });

  const categories: CoachingCategoryView[] = categoryRows.map((row) => ({
    // Logical category id (matches evaluation_category_scores.categoryId).
    // The snapshot row's own id is internal and never reaches the UI.
    id: row.category.sourceCategoryId,
    name: row.category.name,
    description: row.category.description,
    scaleType: row.category.scaleType,
    weightPercent: row.category.weightPercent,
    order: row.category.order,
    isAutofail: row.category.isAutofail,
    aiScore: row.score.aiScore,
    humanScore: row.score.humanScore,
    humanScoreReason: row.score.humanScoreReason,
    effectiveScore: row.score.effectiveScore,
    aiReasoning: row.score.aiReasoning,
    highlightedMessageIds: row.score.highlightedMessageIds,
  }));

  const autoFailed = categories.some(
    (c) => c.isAutofail && c.scaleType === "binary" && c.effectiveScore === 0,
  );

  const scoredAgentView: CoachingMemberView | null = head.scoredAgent?.id
    ? head.scoredAgent
    : null;
  const editorView: CoachingMemberView | null = editor ?? null;

  // Build the member lookup. Includes everyone referenced anywhere on this
  // surface: scored agent, editor, ticket assignee, message agents, comment
  // authors, reaction authors. One query for any missing comment/reaction
  // authors that don't already appear elsewhere.
  const membersById = new Map<string, CoachingMemberView>();
  function add(member: CoachingMemberView | null | undefined) {
    if (member?.id) membersById.set(member.id, member);
  }
  add(scoredAgentView);
  add(editorView);
  add(assignee);
  for (const m of messageRows) {
    if (m.teamMember?.id) add(m.teamMember);
  }
  for (const e of eventRows) {
    if (e.actorMember?.id) add(e.actorMember);
  }
  const missingAuthorIds = new Set<string>();
  for (const c of comments) {
    if (!membersById.has(c.authorId)) missingAuthorIds.add(c.authorId);
  }
  for (const r of reactions) {
    if (!membersById.has(r.authorId)) missingAuthorIds.add(r.authorId);
  }
  if (!membersById.has(currentUserId)) missingAuthorIds.add(currentUserId);
  if (missingAuthorIds.size > 0) {
    const extra = await db
      .select({
        id: schema.teamMembers.id,
        name: schema.teamMembers.name,
        avatarColor: schema.teamMembers.avatarColor,
        role: schema.teamMembers.role,
      })
      .from(schema.teamMembers)
      .where(inArray(schema.teamMembers.id, [...missingAuthorIds]));
    for (const m of extra) add(m);
  }

  return {
    evaluation: {
      id: evaluation.id,
      overallScore: evaluation.overallScore,
      status: evaluation.status,
      aiConfidence: evaluation.aiConfidence,
      aiReasoningSummary: evaluation.aiReasoningSummary,
      scoredAt: evaluation.scoredAt.getTime(),
      editedAt: evaluation.editedAt ? evaluation.editedAt.getTime() : null,
      autoFailed,
      scorecard: head.scorecard,
      scoredAgent: scoredAgentView,
      editor: editorView,
      categories,
    },
    ticket: {
      id: head.ticket.id,
      externalId: head.ticket.externalId,
      subject: head.ticket.subject,
      status: head.ticket.status,
      priority: head.ticket.priority,
      channel: head.ticket.channel,
      customer: customer
        ? { id: customer.id, name: customer.name, tier: customer.tier }
        : null,
      assignee: assignee ?? null,
    },
    messages,
    activities,
    comments,
    reactions,
    membersById: Object.fromEntries(membersById),
    currentUserId,
  };

  // ----- helpers -----

  function describeActivity(
    verb: TicketEventVerb,
    prev: string | null,
    next: string | null,
    actorName: string | null,
  ): string {
    const who = actorName ?? "System";
    switch (verb) {
      case "ticket_created":
        return "Ticket created";
      case "status_changed":
        return `Status: ${prev ?? "—"} → ${next ?? "—"}`;
      case "assignee_changed":
        return next ? `Assigned to ${next}` : "Assignee changed";
      case "group_changed":
        return next ? `Group changed to ${next}` : "Group changed";
      case "priority_changed":
        return `Priority: ${prev ?? "—"} → ${next ?? "—"}`;
      case "tag_added":
        return `Tag added${next ? `: ${next}` : ""}`;
      case "tag_removed":
        return `Tag removed${prev ? `: ${prev}` : ""}`;
      case "subject_changed":
        return "Subject changed";
      case "merged":
        return "Ticket merged";
      case "survey_sent":
        return "Survey sent";
      case "survey_response_received":
        return "Survey response received";
      case "sla_breached":
        return "SLA breached";
      case "ticket_reopened":
        return `Reopened by ${who}`;
      default:
        return verb;
    }
  }
}

/** Round-one current-user stub — mirrors the resolver in qa/coaching/actions.ts
 *  and qa/actions.ts. Picks the first Customer Care Lead deterministically
 *  within the active workspace. */
async function resolveCurrentUserId(workspaceId: string): Promise<string> {
  const [manager] = await db
    .select({ id: schema.teamMembers.id })
    .from(schema.teamMembers)
    .where(
      and(
        eq(schema.teamMembers.role, "Customer Care Lead"),
        eq(schema.teamMembers.workspaceId, workspaceId),
      ),
    )
    .orderBy(asc(schema.teamMembers.name))
    .limit(1);
  if (!manager) throw new Error("No current user available");
  return manager.id;
}

// Re-exported here so a category-highlight server action can read the same
// utility without pulling the whole query helper. Keeps the seam clean.
export { resolveCurrentUserId as resolveCoachingCurrentUserId };
