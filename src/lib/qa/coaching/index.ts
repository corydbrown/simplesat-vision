/**
 * Public entry point for QA comments + reactions. Callers (server actions,
 * seed, future route handlers) go through `getCommentProvider()` so the
 * choice of implementation lives in one place. For V1 there's only the mock
 * (which IS production for now); the env switch is reserved for the future
 * Claude-mediated provider.
 *
 * Env: QA_COMMENT_PROVIDER=mock (default). Anything else falls back to mock.
 */

import { MockCommentProvider } from "./mock-provider";
import type { CommentProvider } from "./types";

export type CommentProviderName = "mock";

export function getCommentProvider(
  override?: CommentProviderName,
): CommentProvider {
  const name = override ?? resolveProviderName();
  switch (name) {
    case "mock":
    default:
      return new MockCommentProvider();
  }
}

function resolveProviderName(): CommentProviderName {
  const raw = (process.env.QA_COMMENT_PROVIDER ?? "mock").toLowerCase();
  if (raw === "mock") return "mock";
  return "mock";
}

export { MockCommentProvider } from "./mock-provider";
export {
  COACHING_REACTIONS,
  isCoachingReaction,
  type CoachingReaction,
} from "./reactions";
export type {
  AddReactionInput,
  CommentProvider,
  CommentRow,
  CreateCommentInput,
  ReactionRow,
  ReactionTargetType,
  RemoveReactionInput,
} from "./types";
