"use server";

/**
 * Server actions for QA comments + reactions. Thin wrappers around the
 * CommentProvider that (a) resolve the "current user" (a deterministic stub
 * until auth lands — same pattern as `editCategoryScore` in
 * src/lib/qa/actions.ts), (b) revalidate the ticket detail path so a hard
 * refresh shows the same state the client just optimistically rendered.
 *
 * Own-comments-only edit/delete is enforced inside the provider; these
 * actions just surface the provider's errors to the client.
 */

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireWorkspace } from "@/lib/workspace";
import { getCommentProvider } from "./index";
import { COACHING_REACTIONS } from "./reactions";
import type { CommentRow, ReactionRow } from "./types";

const ReactionTargetTypeSchema = z.enum(["message", "comment", "activity"]);
const EmojiSchema = z.enum(COACHING_REACTIONS);

const CreateCommentSchema = z.object({
  evaluationId: z.string().min(1),
  messageId: z.string().min(1).nullable().optional(),
  activityId: z.string().min(1).nullable().optional(),
  parentCommentId: z.string().min(1).nullable().optional(),
  body: z.string().trim().min(1).max(4000),
});

const EditCommentSchema = z.object({
  commentId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

const DeleteCommentSchema = z.object({
  commentId: z.string().min(1),
});

const ReactionSchema = z.object({
  targetType: ReactionTargetTypeSchema,
  targetId: z.string().min(1),
  evaluationId: z.string().min(1),
  emoji: EmojiSchema,
});

const RemoveReactionSchema = z.object({
  targetType: ReactionTargetTypeSchema,
  targetId: z.string().min(1),
  emoji: EmojiSchema,
});

export async function createComment(input: unknown): Promise<CommentRow> {
  const parsed = parse(CreateCommentSchema, input);
  const currentUserId = await resolveCurrentUserId();
  const provider = getCommentProvider();
  const created = await provider.createComment({
    evaluationId: parsed.evaluationId,
    messageId: parsed.messageId ?? null,
    activityId: parsed.activityId ?? null,
    parentCommentId: parsed.parentCommentId ?? null,
    authorId: currentUserId,
    body: parsed.body,
  });
  await revalidateForEvaluation(parsed.evaluationId);
  return created;
}

export async function editComment(input: unknown): Promise<CommentRow> {
  const parsed = parse(EditCommentSchema, input);
  const currentUserId = await resolveCurrentUserId();
  const provider = getCommentProvider();
  const updated = await provider.editComment(
    parsed.commentId,
    parsed.body,
    currentUserId,
  );
  await revalidateForEvaluation(updated.evaluationId);
  return updated;
}

export async function deleteComment(input: unknown): Promise<{ ok: true }> {
  const parsed = parse(DeleteCommentSchema, input);
  const currentUserId = await resolveCurrentUserId();
  const provider = getCommentProvider();

  // Read evaluationId before deleting so we know what to revalidate.
  const [row] = await db
    .select({ evaluationId: schema.qaComments.evaluationId })
    .from(schema.qaComments)
    .where(eq(schema.qaComments.id, parsed.commentId))
    .limit(1);
  if (!row) throw new Error("Comment not found");

  await provider.deleteComment(parsed.commentId, currentUserId);
  await revalidateForEvaluation(row.evaluationId);
  return { ok: true };
}

export async function addReaction(input: unknown): Promise<ReactionRow> {
  const parsed = parse(ReactionSchema, input);
  const currentUserId = await resolveCurrentUserId();
  const provider = getCommentProvider();
  const reaction = await provider.addReaction({
    targetType: parsed.targetType,
    targetId: parsed.targetId,
    evaluationId: parsed.evaluationId,
    authorId: currentUserId,
    emoji: parsed.emoji,
  });
  await revalidateForEvaluation(parsed.evaluationId);
  return reaction;
}

export async function removeReaction(input: unknown): Promise<{ ok: true }> {
  const parsed = parse(RemoveReactionSchema, input);
  const currentUserId = await resolveCurrentUserId();
  const provider = getCommentProvider();

  // Look up evaluationId via the reaction itself so callers don't have to
  // re-send it — they already know the target.
  const [row] = await db
    .select({ evaluationId: schema.qaReactions.evaluationId })
    .from(schema.qaReactions)
    .where(eq(schema.qaReactions.targetId, parsed.targetId))
    .limit(1);

  await provider.removeReaction({
    targetType: parsed.targetType,
    targetId: parsed.targetId,
    authorId: currentUserId,
    emoji: parsed.emoji,
  });
  if (row) await revalidateForEvaluation(row.evaluationId);
  return { ok: true };
}

/** Attach a category to a message — adds the message to the category's
 *  `highlightedMessageIds` JSON array on the underlying
 *  evaluation_category_scores row. Returns the updated array so the client
 *  can swap into its optimistic state. Idempotent: a re-add is a no-op. */

const AttachCategorySchema = z.object({
  evaluationId: z.string().min(1),
  categoryId: z.string().min(1),
  messageId: z.string().min(1),
});

export async function attachCategoryToMessage(
  input: unknown,
): Promise<{ ok: true; highlightedMessageIds: string[] }> {
  const parsed = parse(AttachCategorySchema, input);
  return mutateHighlights(parsed, (existing) =>
    existing.includes(parsed.messageId)
      ? existing
      : [...existing, parsed.messageId],
  );
}

export async function removeCategoryFromMessage(
  input: unknown,
): Promise<{ ok: true; highlightedMessageIds: string[] }> {
  const parsed = parse(AttachCategorySchema, input);
  return mutateHighlights(parsed, (existing) =>
    existing.filter((m) => m !== parsed.messageId),
  );
}

async function mutateHighlights(
  parsed: { evaluationId: string; categoryId: string; messageId: string },
  transform: (existing: string[]) => string[],
): Promise<{ ok: true; highlightedMessageIds: string[] }> {
  const workspaceId = await requireWorkspace();
  const [row] = await db
    .select({
      highlightedMessageIds:
        schema.evaluationCategoryScores.highlightedMessageIds,
    })
    .from(schema.evaluationCategoryScores)
    .innerJoin(
      schema.evaluations,
      eq(schema.evaluations.id, schema.evaluationCategoryScores.evaluationId),
    )
    .where(
      and(
        eq(
          schema.evaluationCategoryScores.evaluationId,
          parsed.evaluationId,
        ),
        eq(schema.evaluationCategoryScores.categoryId, parsed.categoryId),
        eq(schema.evaluations.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Category score row not found");

  const next = transform(row.highlightedMessageIds);
  if (sameArray(next, row.highlightedMessageIds)) {
    return { ok: true, highlightedMessageIds: next };
  }

  await db
    .update(schema.evaluationCategoryScores)
    .set({ highlightedMessageIds: next })
    .where(
      and(
        eq(
          schema.evaluationCategoryScores.evaluationId,
          parsed.evaluationId,
        ),
        eq(schema.evaluationCategoryScores.categoryId, parsed.categoryId),
      ),
    );

  await revalidateForEvaluation(parsed.evaluationId);
  return { ok: true, highlightedMessageIds: next };
}

function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Round-one current-user stub. Picks the first Customer Care Lead
 *  deterministically — the role that owns QA review in the seed narrative.
 *  Same pattern as `editCategoryScore` in src/lib/qa/actions.ts. Auth
 *  cutover replaces this with the session user. */
async function resolveCurrentUserId(): Promise<string> {
  const [manager] = await db
    .select({ id: schema.teamMembers.id })
    .from(schema.teamMembers)
    .where(eq(schema.teamMembers.role, "Customer Care Lead"))
    .orderBy(asc(schema.teamMembers.name))
    .limit(1);
  if (!manager) throw new Error("No current user available");
  return manager.id;
}

async function revalidateForEvaluation(evaluationId: string): Promise<void> {
  const [row] = await db
    .select({ ticketId: schema.evaluations.ticketId })
    .from(schema.evaluations)
    .where(eq(schema.evaluations.id, evaluationId))
    .limit(1);
  revalidatePath(`/coaching/${evaluationId}`);
  if (row) revalidatePath(`/tickets/${row.ticketId}`);
}

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("[coaching action] invalid input", err.issues);
      throw new Error("Invalid input");
    }
    throw err;
  }
}
