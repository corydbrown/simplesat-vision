/**
 * Mock topic provider. Deterministic, content-blind, no external dependency.
 *
 * Same shape as the seed-time picker in `src/db/seed.ts` (sentiment-biased
 * pools, 0-2 topics per response), but seeded from the response id with a
 * stable hash RNG so the lib stays free of the faker dependency the seed
 * uses. Two callers, two RNG sources, same logic — keeps the seed's
 * deterministic-by-faker.seed(42) output intact while giving the ingest path
 * a callable provider it can use today without an API key.
 *
 * Not a classifier: it never reads `comment` or `answers`. Production deploys
 * that want real topic-attachment must flip `LLM_TOPIC_PROVIDER=llm` (see
 * `index.ts`). The mock exists so the seam works end-to-end in dev / CI / the
 * prototype demo without requiring an API key.
 */

import type { TopicTag } from "@/db/schema";
import { TOPICS } from "./taxonomy";
import type {
  TopicAttachmentInput,
  TopicAttachmentOutput,
  TopicProvider,
} from "./types";

const POSITIVE_TOPIC_BIAS = [
  "helpfulness",
  "courtesy",
  "active-listening",
  "knowledgeable",
  "above-and-beyond",
  "effectiveness",
  "thoroughness",
  "clarity-of-information",
  "customer-service",
  "general-professionalism",
];

const NEGATIVE_TOPIC_BIAS = [
  "wait-time",
  "communication-frequency",
  "billing-clarity",
  "price",
  "product-issue",
  "product-performance",
  "refund-process",
  "documentation-clarity",
  "usability",
  "consistency",
];

const NEUTRAL_TOPIC_BIAS = [
  "product-inquiries",
  "feature-demo",
  "product-usage",
  "trial",
  "training-materials",
  "product-setup",
];

const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));

export const MOCK_TOPIC_PROVIDER_NAME = "mock-rating-bias-v1";

export class MockTopicProvider implements TopicProvider {
  readonly name = MOCK_TOPIC_PROVIDER_NAME;

  async attachTopics(
    input: TopicAttachmentInput,
  ): Promise<TopicAttachmentOutput> {
    const started = Date.now();
    const rng = createRng(input.responseId);
    const sentimentLevel = ratingToSentimentLevel(input.rating, input.scale);
    const count = pickCount(rng);
    const topics: TopicTag[] = [];
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const tag = pickTag(sentimentLevel, rng);
      if (!tag) continue;
      if (!TOPIC_IDS.has(tag.topic)) continue;
      if (used.has(tag.topic)) continue;
      used.add(tag.topic);
      topics.push(tag);
    }
    return {
      topics,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }
}

/** Project the response's rating onto a 1-5 sentiment level, matching the
 *  seed-time scale-aware mapping (so an NPS 10 reads as "promoter" → 5, a
 *  CSAT 1 reads as "bad" → 1). */
function ratingToSentimentLevel(rating: number, scale: number): number {
  if (scale === 11) {
    if (rating <= 6) return Math.max(1, Math.round(rating / 2));
    if (rating <= 8) return 3;
    return 5;
  }
  return Math.max(1, Math.min(5, rating));
}

function pickCount(rng: () => number): number {
  const r = rng();
  if (r < 0.05) return 0;
  if (r < 0.8) return 1;
  return 2;
}

function pickTag(
  sentimentLevel: number,
  rng: () => number,
): TopicTag | null {
  let pool: string[];
  let sentiment: TopicTag["sentiment"];
  if (sentimentLevel >= 4) {
    const r = Math.floor(rng() * 100);
    if (r < 90) {
      pool = POSITIVE_TOPIC_BIAS;
      sentiment = "positive";
    } else if (r < 98) {
      pool = NEUTRAL_TOPIC_BIAS;
      sentiment = "neutral";
    } else {
      pool = NEGATIVE_TOPIC_BIAS;
      sentiment = "negative";
    }
  } else if (sentimentLevel === 3) {
    const r = Math.floor(rng() * 100);
    if (r < 50) {
      pool = NEUTRAL_TOPIC_BIAS;
      sentiment = "neutral";
    } else if (r < 75) {
      pool = NEGATIVE_TOPIC_BIAS;
      sentiment = "negative";
    } else {
      pool = POSITIVE_TOPIC_BIAS;
      sentiment = "positive";
    }
  } else {
    const r = Math.floor(rng() * 100);
    if (r < 85) {
      pool = NEGATIVE_TOPIC_BIAS;
      sentiment = "negative";
    } else if (r < 95) {
      pool = NEUTRAL_TOPIC_BIAS;
      sentiment = "neutral";
    } else {
      pool = POSITIVE_TOPIC_BIAS;
      sentiment = "positive";
    }
  }
  if (pool.length === 0) return null;
  const topic = pool[Math.floor(rng() * pool.length)]!;
  return { topic, sentiment };
}

/** Tiny seeded RNG. xmur3 to derive a 32-bit seed from the response id, then
 *  mulberry32 for the stream. Same response id → same topic sequence; no
 *  faker / Math.random dependency. */
function createRng(seedString: string): () => number {
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function mulberry32() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
