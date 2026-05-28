import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { prefixedId } from "@/lib/ids";
import { snapshotScorecard } from "@/lib/scorecards/snapshot";
import { getScoringProvider } from "./index";
import type {
  ScoringInput,
  ScoringMessage,
  ScoringProvider,
  ScoringScorecard,
} from "./types";
import type {
  NewCoachingNote,
  NewEvaluation,
  NewEvaluationCategoryScore,
} from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

/** The full persisted row set for one scored ticket. Returned (rather than
 *  just the id) so the seed's downstream blocks — coaching comments/reactions
 *  and the re-score clone+drift — can read the exact rows that were written
 *  without re-querying. The runtime action only needs `.evaluationId`. */
export type PersistedEvaluation = {
  evaluationId: string;
  evaluation: NewEvaluation;
  categoryScores: NewEvaluationCategoryScore[];
  coachingNote: NewCoachingNote;
};

/** Thrown for premise failures the UI surfaces verbatim (no messages, no
 *  assignee, etc.) — distinct from unexpected errors. */
export class ScoringPreconditionError extends Error {}

/**
 * Score one ticket against the workspace's default scorecard and persist the
 * evaluation + per-category scores + coaching note. This is the single code
 * path both `seed.ts` and the runtime `evaluateTicket` action go through —
 * the output→rows mapping (status derivation, confidence projection,
 * effective-score defaulting) lives here exactly once so seed and runtime can
 * never drift (per CLAUDE.md: seed runs through the app's code paths).
 *
 * Provider selection is env-driven via `getScoringProvider()` (mock default);
 * callers can inject a provider (seed pins the mock for determinism).
 */
export async function scoreAndPersistTicket(params: {
  ticketId: string;
  workspaceId: string;
  /** Defaults to the env-selected provider (`getScoringProvider()`). */
  provider?: ScoringProvider;
  /** Override the eval timestamp (seed backdates). Defaults to now. */
  scoredAt?: Date;
  /** Pin the scorecard version (seed passes its pre-minted v1). When omitted,
   *  the current default scorecard's version is resolved — minting a snapshot
   *  if one doesn't exist yet. */
  scorecardVersionId?: string;
  /** Run inside an existing transaction for atomic composition. When omitted,
   *  the function opens its own. */
  tx?: Tx;
}): Promise<PersistedEvaluation> {
  const provider = params.provider ?? getScoringProvider();
  const run = (exec: Executor) => persist(exec, { ...params, provider });
  return params.tx ? run(params.tx) : db.transaction(run);
}

async function persist(
  exec: Executor,
  params: {
    ticketId: string;
    workspaceId: string;
    provider: ScoringProvider;
    scoredAt?: Date;
    scorecardVersionId?: string;
  },
): Promise<PersistedEvaluation> {
  const { ticketId, workspaceId, provider } = params;

  // --- Load the ticket (workspace-scoped) ---
  const [ticket] = await exec
    .select({
      id: schema.tickets.id,
      subject: schema.tickets.subject,
      channel: schema.tickets.channel,
      status: schema.tickets.status,
      priority: schema.tickets.priority,
      createdAt: schema.tickets.createdAt,
      solvedAt: schema.tickets.solvedAt,
      tags: schema.tickets.tags,
      teamMemberId: schema.tickets.teamMemberId,
    })
    .from(schema.tickets)
    .where(
      and(
        eq(schema.tickets.id, ticketId),
        eq(schema.tickets.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!ticket) throw new ScoringPreconditionError("Ticket not found");
  if (!ticket.teamMemberId) {
    throw new ScoringPreconditionError(
      "This ticket has no assigned agent — assign it before evaluating.",
    );
  }

  // --- Load messages (chronological) ---
  const messageRows = await exec
    .select()
    .from(schema.ticketMessages)
    .where(eq(schema.ticketMessages.ticketId, ticketId))
    .orderBy(asc(schema.ticketMessages.createdAt));
  if (messageRows.length === 0) {
    throw new ScoringPreconditionError(
      "This ticket has no messages — there's nothing to evaluate.",
    );
  }
  const messages: ScoringMessage[] = messageRows.map((m) => ({
    id: m.id,
    authorRole: m.authorRole,
    authorName: null,
    body: m.body,
    isPublic: m.isPublic,
    createdAt: m.createdAt,
  }));

  // --- Customer CSAT rating projected to 1-5 (conditions the mock) ---
  const [responseRow] = await exec
    .select({ rating: schema.responses.rating, scale: schema.responses.scale })
    .from(schema.responses)
    .where(eq(schema.responses.ticketId, ticketId))
    .limit(1);
  const responseRating = responseRow
    ? Math.round((responseRow.rating * 5) / responseRow.scale)
    : null;

  // --- Load the default scorecard + its rubric ---
  const [scorecard] = await exec
    .select()
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.workspaceId, workspaceId),
        eq(schema.scorecards.isDefault, true),
      ),
    )
    .limit(1);
  if (!scorecard) {
    throw new ScoringPreconditionError(
      "No default scorecard configured for this workspace.",
    );
  }

  const categoryRows = await exec
    .select()
    .from(schema.scorecardCategories)
    .where(eq(schema.scorecardCategories.scorecardId, scorecard.id))
    .orderBy(asc(schema.scorecardCategories.order));
  const criterionRows = await exec
    .select()
    .from(schema.scorecardCriteria)
    .orderBy(asc(schema.scorecardCriteria.order));
  const criteriaByCategoryId = new Map<string, typeof criterionRows>();
  for (const c of criterionRows) {
    const list = criteriaByCategoryId.get(c.categoryId) ?? [];
    list.push(c);
    criteriaByCategoryId.set(c.categoryId, list);
  }

  const scoringScorecard: ScoringScorecard = {
    id: scorecard.id,
    name: scorecard.name,
    version: scorecard.version,
    autoFailFloor: DEFAULT_AUTO_FAIL_FLOOR,
    categories: categoryRows.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      weightPercent: cat.weightPercent,
      scaleType: cat.scaleType,
      isAutofail: cat.isAutofail,
      criteria: (criteriaByCategoryId.get(cat.id) ?? []).map((c) => ({
        id: c.id,
        text: c.text,
      })),
    })),
  };

  // --- Resolve the scorecard version to FK into (mint if absent) ---
  const scorecardVersionId =
    params.scorecardVersionId ??
    (await resolveCurrentScorecardVersionId(exec, {
      scorecardId: scorecard.id,
      version: scorecard.version,
    }));

  // --- Score ---
  const input: ScoringInput = {
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      channel: ticket.channel,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      solvedAt: ticket.solvedAt,
      tags: ticket.tags,
      responseRating,
    },
    messages,
    scorecard: scoringScorecard,
  };
  const output = await provider.scoreConversation(input);

  // --- Map output → rows (the single source of truth for this mapping) ---
  const scoredAt = params.scoredAt ?? new Date();
  const evaluationId = prefixedId("evl");
  const evaluation: NewEvaluation = {
    id: evaluationId,
    workspaceId,
    ticketId: ticket.id,
    scorecardId: scorecard.id,
    scorecardVersionId,
    scoredTeamMemberId: ticket.teamMemberId,
    overallScore: output.overallScore,
    status: output.autoFailTriggered ? "contested" : "ai_scored",
    aiModel: output.aiModel,
    // Confidence stored as integer percent so the column is a plain int.
    aiConfidence: Math.round(output.aiConfidence * 100),
    aiReasoningSummary: output.aiReasoningSummary,
    scoredBy: provider.name,
    scoredAt,
    editedBy: null,
    editedAt: null,
    invalidatedReason: null,
  };

  const categoryScores: NewEvaluationCategoryScore[] = output.categoryScores.map(
    (result) => ({
      id: prefixedId("ecs"),
      evaluationId,
      categoryId: result.categoryId,
      aiScore: result.aiScore,
      humanScore: null,
      effectiveScore: result.aiScore,
      aiReasoning: result.aiReasoning,
      highlightedMessageIds: result.highlightedMessageIds,
    }),
  );

  const coachingNote: NewCoachingNote = {
    id: prefixedId("cnt"),
    workspaceId,
    evaluationId,
    strengthPoints: output.coachingNote.strengthPoints,
    growthPoints: output.coachingNote.growthPoints,
    exampleMessageIds: output.coachingNote.exampleMessageIds,
    generatedBy: provider.name,
    generatedAt: scoredAt,
  };

  // --- Persist ---
  await exec.insert(schema.evaluations).values(evaluation);
  if (categoryScores.length > 0) {
    await exec.insert(schema.evaluationCategoryScores).values(categoryScores);
  }
  await exec.insert(schema.coachingNotes).values(coachingNote);

  return { evaluationId, evaluation, categoryScores, coachingNote };
}

/** Default auto-fail floor — global in Phase 1, mirroring the smoke-test
 *  route and `previewScoreWithDraft`. When the floor becomes per-scorecard,
 *  plumb it off the scorecard row. */
const DEFAULT_AUTO_FAIL_FLOOR = 30;

/** Find the `scorecard_versions` snapshot matching a scorecard's current
 *  version, minting one via the shared `snapshotScorecard` helper if none
 *  exists yet. The mint branch is a safety net — seed mints v1 and the editor
 *  mints on every version bump, so the current version normally always has a
 *  snapshot. Deliberately reuses `snapshotScorecard` (the editor's helper)
 *  rather than authoring a second minting path. */
export async function resolveCurrentScorecardVersionId(
  exec: Executor,
  params: { scorecardId: string; version: number },
): Promise<string> {
  const [existing] = await exec
    .select({ id: schema.scorecardVersions.id })
    .from(schema.scorecardVersions)
    .where(
      and(
        eq(schema.scorecardVersions.scorecardId, params.scorecardId),
        eq(schema.scorecardVersions.version, params.version),
      ),
    )
    .limit(1);
  if (existing) return existing.id;
  return snapshotScorecard(exec, params);
}
