"use server";

/**
 * Server actions for per-evaluation reviewer feedback. The corpus this
 * builds feeds prompt tuning once live LLM scoring is wired in — a separate
 * Claude session reads `evaluation_feedback JOIN evaluations JOIN
 * scorecards JOIN tickets` and proposes prompt + LLM-context adjustments.
 *
 * `createdBy` references `users` (not `team_members`) because feedback is
 * tied to the actual signed-in reviewer, not a team-member persona. The
 * unique index on (`evaluationId`, `createdBy`) makes the write path an
 * upsert: one feedback per (eval, user), edited in place.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCurrentUser } from "@/lib/auth";
import { DEV_AUTH_BYPASS, DEV_USER } from "@/lib/dev-auth";
import { prefixedId } from "@/lib/ids";
import { requireWorkspace } from "@/lib/workspace";
import type { User } from "@/db/schema";

const MAX_FEEDBACK_CHARS = 10_000;

const SaveSchema = z.object({
  evaluationId: z.string().min(1),
  feedbackText: z.string().trim().min(1).max(MAX_FEEDBACK_CHARS),
});

const DeleteSchema = z.object({
  feedbackId: z.string().min(1),
});

const ListSchema = z.object({
  evaluationId: z.string().min(1),
});

export type FeedbackEntry = {
  id: string;
  feedbackText: string;
  createdBy: string;
  authorName: string | null;
  authorEmail: string;
  createdAt: number;
  updatedAt: number;
};

/** Upsert the current user's feedback on this evaluation. One row per
 *  (evaluation, user) — re-saving from the same user overwrites the text
 *  and bumps `updated_at`. Returns the resulting row id so the client can
 *  swap into delete-aware state without a refetch. */
export async function saveEvaluationFeedback(
  input: unknown,
): Promise<{ ok: true; id: string }> {
  const parsed = parse(SaveSchema, input);
  const workspaceId = await requireWorkspace();
  const user = await requireUserPersisted();

  // Confirm the evaluation belongs to this workspace before writing — keeps
  // cross-tenant ids from landing rows in the wrong workspace. Drizzle's FK
  // alone wouldn't catch this (workspaces.id is the FK target but the
  // evaluation row's workspace might differ).
  const [evaluation] = await db
    .select({ id: schema.evaluations.id })
    .from(schema.evaluations)
    .where(
      and(
        eq(schema.evaluations.id, parsed.evaluationId),
        eq(schema.evaluations.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!evaluation) throw new Error("Evaluation not found");

  const now = new Date();
  const id = prefixedId("efb");

  await db
    .insert(schema.evaluationFeedback)
    .values({
      id,
      workspaceId,
      evaluationId: parsed.evaluationId,
      feedbackText: parsed.feedbackText,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.evaluationFeedback.evaluationId,
        schema.evaluationFeedback.createdBy,
      ],
      set: {
        feedbackText: parsed.feedbackText,
        updatedAt: now,
      },
    });

  revalidatePath(`/coaching/${parsed.evaluationId}`);

  // Read the resulting row's id (insert id is unused on update path).
  const [row] = await db
    .select({ id: schema.evaluationFeedback.id })
    .from(schema.evaluationFeedback)
    .where(
      and(
        eq(schema.evaluationFeedback.evaluationId, parsed.evaluationId),
        eq(schema.evaluationFeedback.createdBy, user.id),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Feedback save failed");

  return { ok: true, id: row.id };
}

/** Delete the current user's feedback row. Own-only: the workspace +
 *  createdBy predicate is the guardrail — a row created by another user
 *  (or in another workspace) returns 0 rows and throws. */
export async function deleteEvaluationFeedback(
  input: unknown,
): Promise<{ ok: true }> {
  const parsed = parse(DeleteSchema, input);
  const workspaceId = await requireWorkspace();
  const user = await requireUserPersisted();

  const [row] = await db
    .select({ evaluationId: schema.evaluationFeedback.evaluationId })
    .from(schema.evaluationFeedback)
    .where(
      and(
        eq(schema.evaluationFeedback.id, parsed.feedbackId),
        eq(schema.evaluationFeedback.workspaceId, workspaceId),
        eq(schema.evaluationFeedback.createdBy, user.id),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Feedback not found");

  await db
    .delete(schema.evaluationFeedback)
    .where(
      and(
        eq(schema.evaluationFeedback.id, parsed.feedbackId),
        eq(schema.evaluationFeedback.workspaceId, workspaceId),
        eq(schema.evaluationFeedback.createdBy, user.id),
      ),
    );

  revalidatePath(`/coaching/${row.evaluationId}`);
  return { ok: true };
}

/** List every reviewer's feedback for this evaluation, newest first.
 *  Workspace-scoped via the evaluation join — a forged evaluationId from
 *  another workspace returns nothing. */
export async function listEvaluationFeedback(
  input: unknown,
): Promise<FeedbackEntry[]> {
  const parsed = parse(ListSchema, input);
  const workspaceId = await requireWorkspace();

  const rows = await db
    .select({
      id: schema.evaluationFeedback.id,
      feedbackText: schema.evaluationFeedback.feedbackText,
      createdBy: schema.evaluationFeedback.createdBy,
      authorName: schema.users.name,
      authorEmail: schema.users.email,
      createdAt: schema.evaluationFeedback.createdAt,
      updatedAt: schema.evaluationFeedback.updatedAt,
    })
    .from(schema.evaluationFeedback)
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.evaluationFeedback.createdBy),
    )
    .where(
      and(
        eq(schema.evaluationFeedback.evaluationId, parsed.evaluationId),
        eq(schema.evaluationFeedback.workspaceId, workspaceId),
      ),
    )
    .orderBy(
      desc(schema.evaluationFeedback.updatedAt),
      asc(schema.evaluationFeedback.id),
    );

  return rows.map((r) => ({
    id: r.id,
    feedbackText: r.feedbackText,
    createdBy: r.createdBy,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  }));
}

/** Returns the current user and ensures a matching `users` row exists. The
 *  dev-bypass user (`usr_dev_bypass`) is deliberately not persisted by the
 *  seed (`src/lib/dev-auth.ts` documents the constraint), but the FK on
 *  `evaluation_feedback.created_by` needs a real row. Insert-or-ignore on
 *  every call keeps the seam clean — production uses real WorkOS users
 *  that already exist via `/callback`, so this is a no-op there. */
async function requireUserPersisted(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (DEV_AUTH_BYPASS && user.id === DEV_USER.id) {
    await db
      .insert(schema.users)
      .values({
        id: DEV_USER.id,
        workosId: DEV_USER.workosId,
        email: DEV_USER.email,
        name: DEV_USER.name,
        avatarUrl: DEV_USER.avatarUrl,
        createdAt: DEV_USER.createdAt,
      })
      .onConflictDoNothing({ target: schema.users.id });
  }

  return user;
}

function parse<S extends z.ZodTypeAny>(s: S, input: unknown): z.infer<S> {
  try {
    return s.parse(input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("[evaluation-feedback] invalid input", err.issues);
      throw new Error("Invalid input");
    }
    throw err;
  }
}
