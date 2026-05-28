/**
 * Public entry point for topic-attachment. Callers in route handlers, seed
 * code, and the backfill script go through `getTopicProvider()` rather than
 * constructing a provider directly — keeping the choice of mock vs real-LLM
 * in one place (the env var) means swapping in real classification is a
 * config change, not a code search. Default stays `mock` so dev + CI + the
 * prototype demo remain functional without an API key.
 *
 * Env:
 *   LLM_TOPIC_PROVIDER = mock | llm   (default: mock)
 *   LLM_API_KEY        = required when provider = llm; falls back to
 *                        ANTHROPIC_API_KEY (the SDK's canonical env name)
 *   LLM_TOPIC_MODEL    = model identifier (default: claude-haiku-4-5)
 *
 * Note: `LLM_TOPIC_MODEL` is intentionally separate from `LLM_MODEL` (used by
 * QA scoring). Topic classification is a cheaper task than full conversation
 * scoring; the default leans Haiku rather than reusing the scoring default.
 */

import { LlmTopicProvider } from "./llm-provider";
import { MockTopicProvider } from "./mock-provider";
import type { TopicProvider } from "./types";

export type TopicProviderName = "mock" | "llm";

const DEFAULT_LLM_TOPIC_MODEL = "claude-haiku-4-5";

export function getTopicProvider(override?: TopicProviderName): TopicProvider {
  const name = override ?? resolveProviderName();
  switch (name) {
    case "llm": {
      // Prefer LLM_API_KEY (explicit override) but fall back to the SDK's
      // canonical ANTHROPIC_API_KEY so deploys don't have to maintain a
      // second copy of the same secret.
      const apiKey = process.env.LLM_API_KEY ?? process.env.ANTHROPIC_API_KEY;
      const model = process.env.LLM_TOPIC_MODEL ?? DEFAULT_LLM_TOPIC_MODEL;
      if (!apiKey) {
        throw new Error(
          "Set LLM_API_KEY or ANTHROPIC_API_KEY when LLM_TOPIC_PROVIDER=llm. " +
            "Set LLM_TOPIC_PROVIDER=mock to use the deterministic mock provider.",
        );
      }
      return new LlmTopicProvider({ apiKey, model });
    }
    case "mock":
    default:
      return new MockTopicProvider();
  }
}

function resolveProviderName(): TopicProviderName {
  const rawEnv = process.env.LLM_TOPIC_PROVIDER;
  if (rawEnv == null || rawEnv === "") return "mock";
  const normalized = rawEnv.toLowerCase();
  if (normalized === "llm" || normalized === "mock") return normalized;
  console.warn(
    `[topics] Unrecognized LLM_TOPIC_PROVIDER="${rawEnv}". ` +
      `Falling back to "mock". Valid values: "mock" | "llm".`,
  );
  return "mock";
}

// Re-export the taxonomy + rollup so existing `import { ... } from "@/lib/topics"`
// callers keep working unchanged (this file resolves `@/lib/topics`).
export {
  TOPICS,
  TOPIC_BY_ID,
  TOPIC_GROUPS,
  rollupTopics,
  type TopicDef,
} from "./taxonomy";

export { MockTopicProvider } from "./mock-provider";
export { LlmTopicProvider } from "./llm-provider";
export { attachTopicsToResponse } from "./attach";
export type {
  TopicAttachmentInput,
  TopicAttachmentOutput,
  TopicProvider,
} from "./types";
