/**
 * CommentProvider — the seam between callers (server actions, seed, future
 * route handlers) and the comment/reaction storage layer. Mirrors the
 * ScoringProvider pattern from SVP-53:
 *
 * - One interface, plural implementations.
 * - Today: MockCommentProvider reads/writes the local SQLite DB directly.
 *   That IS the production provider for V1 — naming preserves the seam so
 *   when comments grow async behavior (notifications, mention resolution,
 *   moderation) those concerns slot in behind the same interface.
 * - Tomorrow: a Claude-mediated provider could expand @mentions, generate
 *   suggested replies, or summarize threads — same call sites, same shapes.
 *
 * Keep this file free of `db` / `drizzle` imports. Plain shapes in, plain
 * shapes out — that's the contract that makes the provider unit-testable
 * and swappable without dragging implementation details across the seam.
 */

import type { CoachingReaction } from "./reactions";

/** A comment row as returned to the UI. Snake-case DB columns mapped to
 *  camelCase here. `parentCommentId`/`messageId`/`activityId` may be null
 *  per the threading + anchoring rules in the schema. */
export type CommentRow = {
  id: string;
  evaluationId: string;
  messageId: string | null;
  activityId: string | null;
  parentCommentId: string | null;
  authorId: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateCommentInput = {
  /** The active workspace id, plumbed from the caller's `requireWorkspace()`.
   *  Persisted onto the row + verified against the evaluation's workspace
   *  inside the provider so a forged evaluationId from another workspace
   *  can't anchor a comment here. */
  workspaceId: string;
  evaluationId: string;
  /** Pass at most one anchor — both null = top-level evaluation comment. */
  messageId?: string | null;
  activityId?: string | null;
  parentCommentId?: string | null;
  authorId: string;
  body: string;
};

export type ReactionTargetType = "message" | "comment" | "activity";

export type ReactionRow = {
  id: string;
  targetType: ReactionTargetType;
  targetId: string;
  evaluationId: string;
  authorId: string;
  emoji: CoachingReaction;
  createdAt: number;
};

export type AddReactionInput = {
  workspaceId: string;
  targetType: ReactionTargetType;
  targetId: string;
  evaluationId: string;
  authorId: string;
  emoji: CoachingReaction;
};

export type RemoveReactionInput = {
  workspaceId: string;
  targetType: ReactionTargetType;
  targetId: string;
  authorId: string;
  emoji: CoachingReaction;
};

export interface CommentProvider {
  readonly name: string;
  listComments(
    evaluationId: string,
    workspaceId: string,
  ): Promise<CommentRow[]>;
  createComment(input: CreateCommentInput): Promise<CommentRow>;
  /** Updates `body`. Throws if `currentUserId !== authorId` — own-comments
   *  only per V1 policy. Workspace-scoped: a comment id from another
   *  workspace is treated as not-found. */
  editComment(
    id: string,
    body: string,
    currentUserId: string,
    workspaceId: string,
  ): Promise<CommentRow>;
  /** Hard delete. Cascades to thread replies via FK. Throws if
   *  `currentUserId !== authorId`. Workspace-scoped. */
  deleteComment(
    id: string,
    currentUserId: string,
    workspaceId: string,
  ): Promise<void>;
  /** Idempotent — re-adding an existing (target, author, emoji) is a no-op
   *  thanks to the unique index. Returns the existing row in that case. */
  addReaction(input: AddReactionInput): Promise<ReactionRow>;
  removeReaction(input: RemoveReactionInput): Promise<void>;
  listReactions(
    evaluationId: string,
    workspaceId: string,
  ): Promise<ReactionRow[]>;
}
