import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { liveResponsesFilter } from "@/db/queries/live-responses";
import { prefixedId } from "@/lib/ids";
import { estimateCostCents } from "@/lib/llm/pricing";
import { initDefaultScorecardForWorkspace } from "@/lib/qa/default-scorecard-init";
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
  /** Pin which scorecard to score against (SVP-229's manual "Re-score with…"
   *  picker passes this). When provided, must be live (not archived) and
   *  workspace-scoped or it throws. When omitted, falls back to "any live
   *  scorecard, oldest first" — the pre-multi-scorecard behavior. */
  scorecardId?: string;
  /** Use this executor for the *write* portion. Lets a caller bundle the
   *  inserts into an outer transaction for atomic composition. The reads +
   *  the provider call always run outside any transaction — they're the slow
   *  steps, and we don't want to hold a Turso write-tx open across a multi-
   *  second LLM round-trip. */
  tx?: Tx;
  /** Tag the resulting evaluation row with the rule that triggered it
   *  (SVP-232). NULL = manual / re-score / seed-time. Lets reports group
   *  evals by rule and count cap hits. */
  autoScoringRuleId?: string | null;
  /** Override the actor whose work is being scored (SVP-273 fan-out). When
   *  omitted, defaults to `ticket.teamMemberId` — preserving every pre-
   *  SVP-273 caller's behavior. Pass an explicit value (including `null`)
   *  for AI/Resolution scorecards: AI evals pin the bot's `team_members.id`
   *  (or `null` pre-SVP-269/1c); Resolution evals always pin `null`. The
   *  `scorecards.applies_to` discriminant gates which combinations are
   *  legal — Human scorecards still require a non-null actor and will
   *  throw a `ScoringPreconditionError` if neither this param nor the
   *  ticket's assignee resolves one. */
  scoredTeamMemberId?: string | null;
}): Promise<PersistedEvaluation> {
  const provider = params.provider ?? getScoringProvider();
  const { ticketId, workspaceId } = params;

  // ============================================================
  // READS — run on the connection pool, no transaction held open.
  // ============================================================

  const [ticket] = await db
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

  // SVP-273: the actor whose work is being scored is now derivable two ways.
  //   1. Explicit param (`params.scoredTeamMemberId`) — passed by the
  //      fan-out engine, which has the `scorecards.applies_to` context and
  //      picks the right human/bot/null per assignment. We honor it
  //      verbatim, INCLUDING explicit `null` (Resolution scorecards write
  //      NULL on purpose).
  //   2. Implicit default — the ticket's currently-assigned human. This
  //      preserves every pre-SVP-273 caller (seed, manual "Evaluate" action,
  //      "Run rule once", "Re-score with…" picker) whose mental model is
  //      "this ticket's assignee is the one being scored." For those
  //      callers we still throw `ScoringPreconditionError` if no assignee
  //      exists, because they have no way to express "score this
  //      conversation against a Resolution scorecard with no actor."
  const scoredTeamMemberId: string | null =
    params.scoredTeamMemberId !== undefined
      ? params.scoredTeamMemberId
      : ticket.teamMemberId;
  if (scoredTeamMemberId === null && params.scoredTeamMemberId === undefined) {
    throw new ScoringPreconditionError(
      "This ticket has no assigned agent — assign it before evaluating.",
    );
  }

  const messageRows = await db
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

  // Customer CSAT rating projected to 1-5 (conditions the mock). Filter to
  // the live (non-superseded) response so QA scoring sees the Simplesat-native
  // signal when both that and a helpdesk-native row exist on the ticket.
  const [responseRow] = await db
    .select({ rating: schema.responses.rating, scale: schema.responses.scale })
    .from(schema.responses)
    .where(
      and(
        eq(schema.responses.ticketId, ticketId),
        liveResponsesFilter(),
      ),
    )
    .limit(1);
  const responseRating = responseRow
    ? Math.round((responseRow.rating * 5) / responseRow.scale)
    : null;

  // Scorecard resolution. SVP-229 added the manual `scorecardId` override
  // (the "Re-score with…" picker on /coaching). When omitted, SVP-242 checks
  // the workspace's chosen default scorecard before falling back to "any live
  // scorecard, oldest first" — auto-initing IQS for fresh workspaces (WorkOS
  // signup) that don't have one yet. SVP-232 adds the rules engine that
  // selects *which* scorecard a new ticket runs against automatically; rules
  // pass an explicit `scorecardId` so they bypass this fallback chain.
  let scorecard;
  if (params.scorecardId) {
    [scorecard] = await db
      .select()
      .from(schema.scorecards)
      .where(
        and(
          eq(schema.scorecards.id, params.scorecardId),
          eq(schema.scorecards.workspaceId, workspaceId),
          isNull(schema.scorecards.archivedAt),
        ),
      )
      .limit(1);
    if (!scorecard) {
      throw new ScoringPreconditionError(
        "Selected scorecard is not available — it may have been archived.",
      );
    }
  } else {
    // SVP-242: try the workspace default first. If it points at an archived
    // (or missing) scorecard, fall through silently rather than throwing —
    // the /settings/scorecards "Default" badge stops showing when the row is
    // null, which is the user-visible signal that the default needs re-picking.
    const [workspaceRow] = await db
      .select({ defaultScorecardId: schema.workspaces.defaultScorecardId })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .limit(1);
    if (workspaceRow?.defaultScorecardId) {
      [scorecard] = await db
        .select()
        .from(schema.scorecards)
        .where(
          and(
            eq(schema.scorecards.id, workspaceRow.defaultScorecardId),
            eq(schema.scorecards.workspaceId, workspaceId),
            isNull(schema.scorecards.archivedAt),
          ),
        )
        .limit(1);
    }
    if (!scorecard) {
      const selectAnyScorecard = () =>
        db
          .select()
          .from(schema.scorecards)
          .where(
            and(
              eq(schema.scorecards.workspaceId, workspaceId),
              isNull(schema.scorecards.archivedAt),
            ),
          )
          .orderBy(asc(schema.scorecards.createdAt))
          .limit(1);
      [scorecard] = await selectAnyScorecard();
      if (!scorecard) {
        await initDefaultScorecardForWorkspace(workspaceId);
        [scorecard] = await selectAnyScorecard();
        if (!scorecard) {
          throw new ScoringPreconditionError(
            "Failed to initialize a scorecard for this workspace.",
          );
        }
      }
    }
  }

  // SVP-273: defense-in-depth. The picker layer should never hand us a
  // Human scorecard with a null actor (it prunes those), but a manual
  // caller passing `scoredTeamMemberId: null` against a Human scorecard
  // would otherwise silently write a meaningless eval. Catch it here so
  // the failure surfaces with a clear precondition error instead.
  if (scorecard.appliesTo === "human" && scoredTeamMemberId === null) {
    throw new ScoringPreconditionError(
      "Human scorecards require a non-null scored_team_member_id.",
    );
  }

  const categoryRows = await db
    .select()
    .from(schema.scorecardCategories)
    .where(eq(schema.scorecardCategories.scorecardId, scorecard.id))
    .orderBy(asc(schema.scorecardCategories.order));
  const criterionRows = await db
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
    scoringPhilosophy: scorecard.scoringPhilosophy,
    bandDescriptors: scorecard.bandDescriptors,
    domainContext: scorecard.domainContext,
    toneExpectations: scorecard.toneExpectations,
    categories: categoryRows.map((cat) => {
      const catCriteria = criteriaByCategoryId.get(cat.id) ?? [];
      return {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        weightPercent: catCriteria.reduce(
          (acc, c) => acc + c.weightPercent,
          0,
        ),
        scaleType: cat.scaleType,
        isAutofail: cat.isAutofail,
        criteria: catCriteria.map((c) => ({
          id: c.id,
          text: c.text,
          weightPercent: c.weightPercent,
        })),
      };
    }),
  };

  // Pre-resolve the scorecard version snapshot with a plain SELECT. The mint
  // safety-net (rare path) happens inside the write transaction so it stays
  // atomic with the eval insert. Splitting it this way keeps the LLM call
  // out of the write tx without sacrificing rollback semantics.
  let preResolvedVersionId = params.scorecardVersionId;
  if (!preResolvedVersionId) {
    const [existing] = await db
      .select({ id: schema.scorecardVersions.id })
      .from(schema.scorecardVersions)
      .where(
        and(
          eq(schema.scorecardVersions.scorecardId, scorecard.id),
          eq(schema.scorecardVersions.version, scorecard.version),
        ),
      )
      .limit(1);
    preResolvedVersionId = existing?.id;
  }

  // ============================================================
  // SCORE — outside any transaction. Real-LLM round-trip takes
  // multiple seconds; holding a Turso write-tx open across that
  // invites lock contention + interactive-transaction timeouts.
  // If this throws nothing has been written yet → clean rollback.
  // ============================================================

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

  // ============================================================
  // WRITES — short transaction: optional snapshot mint + 3 inserts.
  // Row ids are minted inside so they're part of the same global-
  // rng sequence as the output→row mapping in `seed.ts` used to be;
  // determinism preserved (mock provider uses its own private faker
  // seeded from the ticket id, so its rng calls don't interleave).
  // ============================================================

  const writer = async (exec: Executor): Promise<PersistedEvaluation> => {
    const scorecardVersionId =
      preResolvedVersionId ??
      (await snapshotScorecard(exec, {
        scorecardId: scorecard.id,
        version: scorecard.version,
      }));

    const scoredAt = params.scoredAt ?? new Date();
    const evaluationId = prefixedId("evl");
    // Cost is computed inline rather than denormalized from a separate table:
    // the snapshot price + token counts are all already on this row, so the
    // computation is reproducible from row state alone. Null when the provider
    // doesn't supply token counts (mock) or when the pricing config doesn't
    // know about (provider, model) yet — don't fabricate.
    const costUsdCents =
      output.inputTokens !== null && output.outputTokens !== null
        ? estimateCostCents(
            output.aiProvider,
            output.aiModel,
            output.inputTokens,
            output.outputTokens,
            scoredAt,
          )
        : null;
    const evaluation: NewEvaluation = {
      id: evaluationId,
      workspaceId,
      ticketId: ticket.id,
      scorecardId: scorecard.id,
      scorecardVersionId,
      scoredTeamMemberId,
      overallScore: output.overallScore,
      status: output.autoFailTriggered ? "contested" : "ai_scored",
      aiModel: output.aiModel,
      aiProvider: output.aiProvider,
      inputTokens: output.inputTokens,
      outputTokens: output.outputTokens,
      costUsdCents,
      // Confidence stored as integer percent so the column is a plain int.
      aiConfidence: Math.round(output.aiConfidence * 100),
      aiReasoningSummary: output.aiReasoningSummary,
      scoredBy: provider.name,
      scoredAt,
      editedBy: null,
      editedAt: null,
      invalidatedReason: null,
      autoScoringRuleId: params.autoScoringRuleId ?? null,
    };

    const categoryScores: NewEvaluationCategoryScore[] =
      output.categoryScores.map((result) => ({
        id: prefixedId("ecs"),
        evaluationId,
        categoryId: result.categoryId,
        aiScore: result.aiScore,
        humanScore: null,
        effectiveScore: result.aiScore,
        aiReasoning: result.aiReasoning,
        highlightedMessageIds: result.highlightedMessageIds,
      }));

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

    await exec.insert(schema.evaluations).values(evaluation);
    if (categoryScores.length > 0) {
      await exec.insert(schema.evaluationCategoryScores).values(categoryScores);
    }
    await exec.insert(schema.coachingNotes).values(coachingNote);

    return { evaluationId, evaluation, categoryScores, coachingNote };
  };

  return params.tx ? writer(params.tx) : db.transaction(writer);
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
