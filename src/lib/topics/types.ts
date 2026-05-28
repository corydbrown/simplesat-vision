/**
 * Topic-attachment provider interface. Mirrors the shape of `qa/scoring` so
 * the two AI subsystems read the same way: a stable `TopicProvider` interface
 * with a `MockTopicProvider` (deterministic, no external dependency) and an
 * `LlmTopicProvider` (real classification). Provider selection is env-driven
 * via `getTopicProvider()` (see `index.ts`) — swapping mock → real is a config
 * change, not a code edit.
 */

import type { SurveyAnswer, TopicTag } from "@/db/schema";

export interface TopicAttachmentInput {
  /** Stable id of the response being classified. Used by the mock provider as
   *  a deterministic RNG seed and surfaced in logs / errors. */
  responseId: string;
  /** Raw rating value on the response's scale (e.g. 9 on an 11-point NPS). */
  rating: number;
  /** Scale length (5 for CSAT, 7 for CES, 11 for NPS). */
  scale: number;
  /** Top-level free-text comment, when the customer left one. */
  comment: string | null;
  /** All survey answers (question + value), so an LLM can classify against
   *  multi-choice / multi-select / additional comments — not just the headline
   *  comment. The mock provider ignores this; the LLM provider reads it. */
  answers: SurveyAnswer[];
}

export interface TopicAttachmentOutput {
  /** Rolled-up, deduped topics for the whole response. Same shape as
   *  `responses.topics` storage. */
  topics: TopicTag[];
  /** Provider identity. `mock-rating-bias-v1` for the deterministic mock; a
   *  model identifier (e.g. `claude-haiku-4-5`) for the LLM provider. Logged
   *  for observability; not currently persisted on the response. */
  provider: string;
  /** Wall-clock time spent in the provider call. Logged for observability. */
  latencyMs: number;
}

export interface TopicProvider {
  /** Stable provider identifier (see `TopicAttachmentOutput.provider`). */
  readonly name: string;
  attachTopics(input: TopicAttachmentInput): Promise<TopicAttachmentOutput>;
}
