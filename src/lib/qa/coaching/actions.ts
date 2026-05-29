"use server";

/**
 * Server actions for QA comments + reactions. Thin wrappers around the
 * CommentProvider that (a) resolve the signed-in user (SVP-211: writes FK to
 * `users.id`, was a team_member stub before), (b) revalidate the ticket
 * detail path so a hard refresh shows the same state the client just
 * optimistically rendered.
 *
 * Own-comments-only edit/delete is enforced inside the provider; these
 * actions just surface the provider's errors to the client.
 */

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireUserPersisted } from "@/lib/auth/require-user-persisted";
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
  const workspaceId = await requireWorkspace();
  const currentUserId = (await requireUserPersisted()).id;
  const provider = getCommentProvider();
  const created = await provider.createComment({
    workspaceId,
    evaluationId: parsed.evaluationId,
    messageId: parsed.messageId ?? null,
    activityId: parsed.activityId ?? null,
    parentCommentId: parsed.parentCommentId ?? null,
    authorId: currentUserId,
    body: parsed.body,
  });
  await revalidateForEvaluation(parsed.evaluationId, workspaceId);
  return created;
}

export async function editComment(input: unknown): Promise<CommentRow> {
  const parsed = parse(EditCommentSchema, input);
  const workspaceId = await requireWorkspace();
  const currentUserId = (await requireUserPersisted()).id;
  const provider = getCommentProvider();
  const updated = await provider.editComment(
    parsed.commentId,
    parsed.body,
    currentUserId,
    workspaceId,
  );
  await revalidateForEvaluation(updated.evaluationId, workspaceId);
  return updated;
}

export async function deleteComment(input: unknown): Promise<{ ok: true }> {
  const parsed = parse(DeleteCommentSchema, input);
  const workspaceId = await requireWorkspace();
  const currentUserId = (await requireUserPersisted()).id;
  const provider = getCommentProvider();

  // Read evaluationId before deleting so we know what to revalidate. The
  // workspaceId predicate makes a cross-tenant id miss — the provider's
  // delete will also re-check, but we want to fail fast here.
  const [row] = await db
    .select({ evaluationId: schema.qaComments.evaluationId })
    .from(schema.qaComments)
    .where(
      and(
        eq(schema.qaComments.id, parsed.commentId),
        eq(schema.qaComments.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Comment not found");

  await provider.deleteComment(parsed.commentId, currentUserId, workspaceId);
  await revalidateForEvaluation(row.evaluationId, workspaceId);
  return { ok: true };
}

export async function addReaction(input: unknown): Promise<ReactionRow> {
  const parsed = parse(ReactionSchema, input);
  const workspaceId = await requireWorkspace();
  const currentUserId = (await requireUserPersisted()).id;
  const provider = getCommentProvider();
  const reaction = await provider.addReaction({
    workspaceId,
    targetType: parsed.targetType,
    targetId: parsed.targetId,
    evaluationId: parsed.evaluationId,
    authorId: currentUserId,
    emoji: parsed.emoji,
  });
  await revalidateForEvaluation(parsed.evaluationId, workspaceId);
  return reaction;
}

export async function removeReaction(input: unknown): Promise<{ ok: true }> {
  const parsed = parse(RemoveReactionSchema, input);
  const workspaceId = await requireWorkspace();
  const currentUserId = (await requireUserPersisted()).id;
  const provider = getCommentProvider();

  // Look up evaluationId via the reaction itself so callers don't have to
  // re-send it — they already know the target. Workspace-scoped: a forged
  // targetId from another workspace returns no row.
  const [row] = await db
    .select({ evaluationId: schema.qaReactions.evaluationId })
    .from(schema.qaReactions)
    .where(
      and(
        eq(schema.qaReactions.targetId, parsed.targetId),
        eq(schema.qaReactions.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  await provider.removeReaction({
    workspaceId,
    targetType: parsed.targetType,
    targetId: parsed.targetId,
    authorId: currentUserId,
    emoji: parsed.emoji,
  });
  if (row) await revalidateForEvaluation(row.evaluationId, workspaceId);
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

  await revalidateForEvaluation(parsed.evaluationId, workspaceId);
  return { ok: true, highlightedMessageIds: next };
}

function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function revalidateForEvaluation(
  evaluationId: string,
  workspaceId: string,
): Promise<void> {
  const [row] = await db
    .select({ ticketId: schema.evaluations.ticketId })
    .from(schema.evaluations)
    .where(
      and(
        eq(schema.evaluations.id, evaluationId),
        eq(schema.evaluations.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  revalidatePath(`/evaluations/${evaluationId}`);
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
