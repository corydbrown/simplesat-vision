/**
 * MockCommentProvider — the V1 production provider for comments + reactions.
 *
 * Named "Mock" to mirror the ScoringProvider pattern (SVP-53): the seam is
 * what matters, not the implementation behind it. There's no async external
 * comment service to mock today, so this reads/writes the local SQLite DB
 * directly. When notifications, mention resolution, or moderation grow into
 * the comment surface, those concerns slot in behind this same interface
 * without touching call sites.
 */

import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { prefixedId } from "@/lib/ids";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace-id";
import { isCoachingReaction, type CoachingReaction } from "./reactions";
import type {
  AddReactionInput,
  CommentProvider,
  CommentRow,
  CreateCommentInput,
  ReactionRow,
  ReactionTargetType,
  RemoveReactionInput,
} from "./types";

export class MockCommentProvider implements CommentProvider {
  readonly name = "mock-comments-v1";

  async listComments(evaluationId: string): Promise<CommentRow[]> {
    const rows = await db
      .select()
      .from(schema.qaComments)
      .where(eq(schema.qaComments.evaluationId, evaluationId))
      .orderBy(asc(schema.qaComments.createdAt));
    return rows.map(toCommentRow);
  }

  async createComment(input: CreateCommentInput): Promise<CommentRow> {
    const body = input.body.trim();
    if (body.length === 0) {
      throw new Error("Comment body cannot be empty");
    }
    if (body.length > 4000) {
      throw new Error("Comment body exceeds 4000 character limit");
    }
    if (input.messageId && input.activityId) {
      throw new Error(
        "Comment cannot anchor to both a message and an activity — pass at most one",
      );
    }

    const now = new Date();
    const id = prefixedId("qac");
    // Phase 1: hardcoded workspace pending the requireWorkspace() rollout in
    // Phase 2 — the evaluation row already carries workspace_id, so the swap
    // is a lookup via input.evaluationId once query callers move over.
    const row = {
      id,
      workspaceId: DEMO_WORKSPACE_ID,
      evaluationId: input.evaluationId,
      messageId: input.messageId ?? null,
      activityId: input.activityId ?? null,
      parentCommentId: input.parentCommentId ?? null,
      authorId: input.authorId,
      body,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(schema.qaComments).values(row);

    const [inserted] = await db
      .select()
      .from(schema.qaComments)
      .where(eq(schema.qaComments.id, id))
      .limit(1);
    if (!inserted) throw new Error("Comment insert failed");
    return toCommentRow(inserted);
  }

  async editComment(
    id: string,
    body: string,
    currentUserId: string,
  ): Promise<CommentRow> {
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      throw new Error("Comment body cannot be empty");
    }
    if (trimmed.length > 4000) {
      throw new Error("Comment body exceeds 4000 character limit");
    }

    const [existing] = await db
      .select()
      .from(schema.qaComments)
      .where(eq(schema.qaComments.id, id))
      .limit(1);
    if (!existing) throw new Error("Comment not found");
    if (existing.authorId !== currentUserId) {
      throw new Error("Only the comment author can edit it");
    }

    await db
      .update(schema.qaComments)
      .set({ body: trimmed, updatedAt: new Date() })
      .where(eq(schema.qaComments.id, id));

    const [updated] = await db
      .select()
      .from(schema.qaComments)
      .where(eq(schema.qaComments.id, id))
      .limit(1);
    if (!updated) throw new Error("Comment vanished after update");
    return toCommentRow(updated);
  }

  async deleteComment(id: string, currentUserId: string): Promise<void> {
    const [existing] = await db
      .select({ authorId: schema.qaComments.authorId })
      .from(schema.qaComments)
      .where(eq(schema.qaComments.id, id))
      .limit(1);
    if (!existing) throw new Error("Comment not found");
    if (existing.authorId !== currentUserId) {
      throw new Error("Only the comment author can delete it");
    }
    await db.delete(schema.qaComments).where(eq(schema.qaComments.id, id));
  }

  async addReaction(input: AddReactionInput): Promise<ReactionRow> {
    if (!isCoachingReaction(input.emoji)) {
      throw new Error(`Emoji "${input.emoji}" is not in the coaching set`);
    }

    const [existing] = await db
      .select()
      .from(schema.qaReactions)
      .where(
        and(
          eq(schema.qaReactions.targetType, input.targetType),
          eq(schema.qaReactions.targetId, input.targetId),
          eq(schema.qaReactions.authorId, input.authorId),
          eq(schema.qaReactions.emoji, input.emoji),
        ),
      )
      .limit(1);
    if (existing) return toReactionRow(existing);

    const id = prefixedId("qrx");
    const row = {
      id,
      workspaceId: DEMO_WORKSPACE_ID,
      targetType: input.targetType,
      targetId: input.targetId,
      evaluationId: input.evaluationId,
      authorId: input.authorId,
      emoji: input.emoji,
      createdAt: new Date(),
    };
    await db.insert(schema.qaReactions).values(row);

    const [inserted] = await db
      .select()
      .from(schema.qaReactions)
      .where(eq(schema.qaReactions.id, id))
      .limit(1);
    if (!inserted) throw new Error("Reaction insert failed");
    return toReactionRow(inserted);
  }

  async removeReaction(input: RemoveReactionInput): Promise<void> {
    await db
      .delete(schema.qaReactions)
      .where(
        and(
          eq(schema.qaReactions.targetType, input.targetType),
          eq(schema.qaReactions.targetId, input.targetId),
          eq(schema.qaReactions.authorId, input.authorId),
          eq(schema.qaReactions.emoji, input.emoji),
        ),
      );
  }

  async listReactions(evaluationId: string): Promise<ReactionRow[]> {
    const rows = await db
      .select()
      .from(schema.qaReactions)
      .where(eq(schema.qaReactions.evaluationId, evaluationId))
      .orderBy(asc(schema.qaReactions.createdAt));
    return rows.map(toReactionRow);
  }
}

function toCommentRow(r: typeof schema.qaComments.$inferSelect): CommentRow {
  return {
    id: r.id,
    evaluationId: r.evaluationId,
    messageId: r.messageId,
    activityId: r.activityId,
    parentCommentId: r.parentCommentId,
    authorId: r.authorId,
    body: r.body,
    createdAt: (r.createdAt as Date).getTime(),
    updatedAt: (r.updatedAt as Date).getTime(),
  };
}

function toReactionRow(
  r: typeof schema.qaReactions.$inferSelect,
): ReactionRow {
  return {
    id: r.id,
    targetType: r.targetType as ReactionTargetType,
    targetId: r.targetId,
    evaluationId: r.evaluationId,
    authorId: r.authorId,
    emoji: r.emoji as CoachingReaction,
    createdAt: (r.createdAt as Date).getTime(),
  };
}
