import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { responses, type TopicTag } from "@/db/schema";

import { getTopicProvider } from "./index";
import type { TopicProvider } from "./types";

export type AttachTopicsParams = {
  workspaceId: string;
  responseId: string;
  /** Override the env-selected provider (used by tests and the backfill
   *  script's `--provider` flag). Defaults to `getTopicProvider()`. */
  provider?: TopicProvider;
  /** When true, skip the provider call + write if the response already has
   *  non-empty topics. Backfill passes this; the post-write hook does not
   *  (so a re-POST that changes the comment re-classifies). */
  skipIfAttached?: boolean;
  /** When true, load the row + run the provider but skip the DB write.
   *  Used by `scripts/backfill-topics.ts --dry-run` to estimate output
   *  (and, with `--provider llm`, the API spend) before committing. */
  dryRun?: boolean;
};

export type AttachTopicsResult =
  | { ok: true; topics: TopicTag[]; skipped: boolean; provider: string }
  | { ok: false; reason: "not-found" | "skipped"; topics?: TopicTag[] };

/**
 * Classify a single response against the topic taxonomy and persist the
 * rolled-up topics. The single code path used by:
 *   - the `/api/responses` post-write hook (fire-and-forget via `after()`)
 *   - the `scripts/backfill-topics.ts` one-shot script
 *   - (future) re-classification when a comment is edited
 *
 * Idempotent in two senses:
 *   1. Writes always overwrite `responses.topics` with the fresh result, so
 *      repeated calls converge on the same value (modulo LLM nondeterminism
 *      — the mock is fully deterministic by response id).
 *   2. With `skipIfAttached: true`, a response that already has topics is a
 *      no-op — the backfill skips already-classified rows and stays cheap to
 *      re-run.
 */
export async function attachTopicsToResponse(
  params: AttachTopicsParams,
): Promise<AttachTopicsResult> {
  const {
    workspaceId,
    responseId,
    skipIfAttached = false,
    dryRun = false,
  } = params;
  const provider = params.provider ?? getTopicProvider();

  const [row] = await db
    .select({
      id: responses.id,
      rating: responses.rating,
      scale: responses.scale,
      comment: responses.comment,
      answers: responses.answers,
      topics: responses.topics,
    })
    .from(responses)
    .where(
      and(eq(responses.workspaceId, workspaceId), eq(responses.id, responseId)),
    )
    .limit(1);
  if (!row) {
    return { ok: false, reason: "not-found" };
  }

  if (skipIfAttached && row.topics.length > 0) {
    return { ok: false, reason: "skipped", topics: row.topics };
  }

  const output = await provider.attachTopics({
    responseId: row.id,
    rating: row.rating,
    scale: row.scale,
    comment: row.comment ?? null,
    answers: row.answers,
  });

  if (!dryRun) {
    await db
      .update(responses)
      .set({ topics: output.topics })
      .where(eq(responses.id, row.id));
  }

  return {
    ok: true,
    topics: output.topics,
    skipped: false,
    provider: output.provider,
  };
}
