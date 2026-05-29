"use server";

import { and, desc, eq, gt, isNotNull, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireUserPersisted } from "@/lib/auth/require-user-persisted";
import { DEFAULT_SCORECARD } from "@/lib/qa/default-scorecard";
import { scoreAndPersistTicket } from "@/lib/qa/scoring/persist";
import { requireWorkspace } from "@/lib/workspace";

/** Result returned to the client after a successful inline edit. Carries the
 *  values the card needs to swap into display mode without a full refetch. */
export type EditCategoryScoreResult = {
  ok: true;
  category: {
    categoryId: string;
    humanScore: number;
    humanScoreReason: string;
    effectiveScore: number;
  };
  evaluation: {
    id: string;
    status: "edited";
    overallScore: number;
    editedAt: number;
    editor: { id: string; name: string | null; avatarUrl: string | null };
  };
};

const InputSchema = z.object({
  evaluationId: z.string().min(1),
  categoryId: z.string().min(1),
  humanScore: z.number().int().min(0).max(5),
  reason: z.string().trim().min(8).max(500),
});

export async function editCategoryScore(
  input: unknown,
): Promise<EditCategoryScoreResult> {
  const workspaceId = await requireWorkspace();
  let parsed: z.infer<typeof InputSchema>;
  try {
    parsed = InputSchema.parse(input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("[qa edit] invalid input", err.issues);
      throw new Error("Invalid input");
    }
    throw err;
  }

  const [evalExists] = await db
    .select({ id: schema.evaluations.id })
    .from(schema.evaluations)
    .where(
      and(
        eq(schema.evaluations.id, parsed.evaluationId),
        eq(schema.evaluations.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!evalExists) throw new Error("Evaluation not found");

  // Validate scale-shape before persisting: binary categories accept 0|1,
  // likert_5 accepts 1-5, three_state accepts 0|1|2. Catches mismatched
  // payloads from a client that's out of sync with the scorecard schema.
  // Scoped via inner-join to scorecards so a forged categoryId from another
  // workspace's scorecard can't pass this gate.
  const [targetCategory] = await db
    .select({
      scaleType: schema.scorecardCategories.scaleType,
      isAutofail: schema.scorecardCategories.isAutofail,
    })
    .from(schema.scorecardCategories)
    .innerJoin(
      schema.scorecards,
      eq(schema.scorecards.id, schema.scorecardCategories.scorecardId),
    )
    .where(
      and(
        eq(schema.scorecardCategories.id, parsed.categoryId),
        eq(schema.scorecards.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!targetCategory) throw new Error("Category not found");
  if (!isScoreValidForScale(targetCategory.scaleType, parsed.humanScore)) {
    throw new Error("Score out of range for this category's scale");
  }

  // SVP-211: editor is the signed-in user. `editedBy` FKs to `users.id`
  // (was team_members.id before SVP-211; see migration 0029). Any signed-in
  // user with workspace access can edit scores — they don't have to be an
  // agent in the helpdesk.
  const editor = await requireUserPersisted();

  const editedAt = new Date();
  const ticketId = await db.transaction(async (tx) => {
    await tx
      .update(schema.evaluationCategoryScores)
      .set({
        humanScore: parsed.humanScore,
        humanScoreReason: parsed.reason,
        effectiveScore: parsed.humanScore,
      })
      .where(
        and(
          eq(schema.evaluationCategoryScores.evaluationId, parsed.evaluationId),
          eq(schema.evaluationCategoryScores.categoryId, parsed.categoryId),
        ),
      );

    // Read back all categories for this evaluation so the overall recomputes
    // against the freshly-written effective_score (the row we just updated
    // plus every other category's existing effective_score). Per SVP-228 the
    // weight summation reads criterion-level weights — sum them per category
    // here in SQL so the recompute formula matches the providers.
    const rows = await tx
      .select({
        weightPercent: sql<number>`COALESCE((
          SELECT SUM("scorecard_criteria"."weight_percent")
          FROM "scorecard_criteria"
          WHERE "scorecard_criteria"."category_id" = "scorecard_categories"."id"
        ), 0)`,
        scaleType: schema.scorecardCategories.scaleType,
        isAutofail: schema.scorecardCategories.isAutofail,
        effectiveScore: schema.evaluationCategoryScores.effectiveScore,
      })
      .from(schema.evaluationCategoryScores)
      .innerJoin(
        schema.scorecardCategories,
        eq(
          schema.scorecardCategories.id,
          schema.evaluationCategoryScores.categoryId,
        ),
      )
      .where(
        eq(schema.evaluationCategoryScores.evaluationId, parsed.evaluationId),
      );

    const overallScore = recomputeOverall(rows);

    const [updated] = await tx
      .update(schema.evaluations)
      .set({
        status: "edited",
        editedBy: editor.id,
        editedAt,
        overallScore,
      })
      .where(eq(schema.evaluations.id, parsed.evaluationId))
      .returning({
        ticketId: schema.evaluations.ticketId,
        overallScore: schema.evaluations.overallScore,
      });
    if (!updated) throw new Error("Evaluation not found");

    return updated.ticketId;
  });

  // Invalidate the ticket detail page so a hard refresh shows the same state
  // the client just optimistically rendered.
  revalidatePath(`/tickets/${ticketId}`);

  // Re-read the just-written overall — recomputeOverall is local and cheap
  // but reading it back keeps a single source of truth.
  const [fresh] = await db
    .select({ overallScore: schema.evaluations.overallScore })
    .from(schema.evaluations)
    .where(eq(schema.evaluations.id, parsed.evaluationId))
    .limit(1);

  return {
    ok: true,
    category: {
      categoryId: parsed.categoryId,
      humanScore: parsed.humanScore,
      humanScoreReason: parsed.reason,
      effectiveScore: parsed.humanScore,
    },
    evaluation: {
      id: parsed.evaluationId,
      status: "edited",
      overallScore: fresh?.overallScore ?? 0,
      editedAt: editedAt.getTime(),
      editor: {
        id: editor.id,
        name: editor.name,
        avatarUrl: editor.avatarUrl,
      },
    },
  };
}

/** Run a real (provider-driven) QA evaluation for a ticket and persist it.
 *  Manual / on-demand — the user picks the ticket and triggers this from the
 *  ticket detail page (or the Coaching picker). A fresh evaluation row is
 *  always created; re-scoring a ticket stacks a new evaluation (history is a
 *  feature) and the latest becomes the head shown on the ticket.
 *
 *  Provider is env-selected (`mock` by default; `llm` when configured on the
 *  deploy). Returns the new evaluation id so the client can navigate to
 *  `/evaluations/[evaluationId]`.
 *
 *  `scorecardId` (SVP-229) pins which scorecard scores the ticket — passed by
 *  the "Re-score with…" picker on the coaching detail page. When omitted, the
 *  pre-multi-scorecard fallback resolves "any live scorecard, oldest first". */
export async function evaluateTicket(
  ticketId: string,
  options: { scorecardId?: string } = {},
): Promise<{ evaluationId: string }> {
  // SVP-243 instrumentation: a re-score from the picker has 500'd once on prod
  // (first click failed, second succeeded) with no recoverable log line by the
  // time we looked. Tag the full error here so the next occurrence leaves a
  // single grep-able stack in Vercel logs — `[svp243]` is the marker.
  try {
    const workspaceId = await requireWorkspace();
    if (typeof ticketId !== "string" || ticketId.length === 0) {
      throw new Error("Invalid ticket id");
    }

    const { evaluationId } = await scoreAndPersistTicket({
      ticketId,
      workspaceId,
      scorecardId: options.scorecardId,
    });

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath("/evaluations");

    return { evaluationId };
  } catch (err) {
    console.error(
      `[svp243] evaluateTicket failed ticket=${ticketId} scorecardId=${options.scorecardId ?? "(auto)"}:`,
      err,
    );
    throw err;
  }
}

export type ScorableTicketRow = {
  id: string;
  subject: string;
  customerName: string | null;
  /** Already has ≥1 evaluation — re-scoring stacks a fresh one. The picker
   *  surfaces this so the user isn't surprised. */
  alreadyScored: boolean;
};

/** Tickets that can be manually evaluated: they have messages (a conversation
 *  to read) and an assigned agent (scoring attributes to them). Powers the
 *  "New evaluation" picker on /coaching. Distinct from
 *  `searchScoredTickets` (scorecard editor preview), which only returns
 *  tickets that already have an evaluation. */
export async function searchScorableTickets(
  rawQuery: string,
): Promise<ScorableTicketRow[]> {
  const workspaceId = await requireWorkspace();
  const q = rawQuery.trim();
  const pattern = q.length === 0 ? null : `%${q}%`;

  const where = and(
    eq(schema.tickets.workspaceId, workspaceId),
    gt(schema.tickets.messageCount, 0),
    isNotNull(schema.tickets.teamMemberId),
    pattern
      ? or(
          like(schema.tickets.subject, pattern),
          like(schema.customers.name, pattern),
        )
      : undefined,
  );

  const rows = await db
    .select({
      id: schema.tickets.id,
      subject: schema.tickets.subject,
      customerName: schema.customers.name,
      // Literal column refs inside the correlated subquery — Drizzle's
      // `${schema...}` interpolation would emit a bound param, not a column.
      evaluationCount: sql<number>`(
        SELECT COUNT(*) FROM "evaluations"
        WHERE "evaluations"."ticket_id" = "tickets"."id"
      )`,
    })
    .from(schema.tickets)
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, schema.tickets.customerId),
    )
    .where(where)
    .orderBy(desc(schema.tickets.createdAt))
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    customerName: r.customerName,
    alreadyScored: Number(r.evaluationCount) > 0,
  }));
}

function isScoreValidForScale(scale: string, score: number): boolean {
  if (scale === "binary") return score === 0 || score === 1;
  if (scale === "three_state") return score >= 0 && score <= 2;
  // likert_5
  return score >= 1 && score <= 5;
}

/** Mirrors `mock-provider.computeOverallScore` but reads effective scores
 *  (post-human-edit) instead of AI scores. Kept inline to avoid pulling the
 *  provider into the action's import graph — the formula is small enough to
 *  copy and the two paths intentionally evolve independently.
 *
 *  SVP-228: `weightPercent` is the *sum of criterion weights* in this
 *  category (computed in the calling SELECT), not the legacy category column.
 *  Mathematically equivalent for the seeded IQS rubric and correct for
 *  future scorecards with multiple weighted criteria per category. */
function recomputeOverall(
  categories: {
    weightPercent: number;
    scaleType: string;
    isAutofail: boolean;
    effectiveScore: number;
  }[],
): number {
  const autoFailed = categories.some(
    (c) => c.isAutofail && c.scaleType === "binary" && c.effectiveScore === 0,
  );
  if (autoFailed) return DEFAULT_SCORECARD.autoFailFloor;

  let weighted = 0;
  let weightSum = 0;
  for (const c of categories) {
    if (c.isAutofail) continue;
    if (c.scaleType !== "likert_5") continue;
    const projected = ((c.effectiveScore - 1) / 4) * 100;
    weighted += projected * c.weightPercent;
    weightSum += c.weightPercent;
  }
  if (weightSum === 0) return 0;
  return Math.round(weighted / weightSum);
}
