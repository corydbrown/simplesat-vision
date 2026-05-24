/**
 * Public entry point for QA scoring. Callers in seed code and route
 * handlers go through `getScoringProvider()` rather than constructing a
 * provider directly — keeping the choice of mock vs real-LLM in one place
 * (the env var) means swapping in real scoring is a config change, not a
 * code search. Default stays `mock` so dev + CI + the seed pipeline remain
 * deterministic without an API key.
 *
 * Env:
 *   LLM_SCORING_PROVIDER = mock | llm   (default: mock)
 *   LLM_API_KEY          = required when provider = llm
 *   LLM_MODEL            = model identifier (default: claude-opus-4-7)
 */

import { LlmScoringProvider } from "./llm-provider";
import { MockScoringProvider } from "./mock-provider";
import type { ScoringProvider } from "./types";

export type ScoringProviderName = "mock" | "llm";

const DEFAULT_LLM_MODEL = "claude-opus-4-7";

export function getScoringProvider(
  override?: ScoringProviderName,
): ScoringProvider {
  const name = override ?? resolveProviderName();
  switch (name) {
    case "llm": {
      const apiKey = process.env.LLM_API_KEY;
      const model = process.env.LLM_MODEL ?? DEFAULT_LLM_MODEL;
      if (!apiKey) {
        throw new Error(
          "LLM_API_KEY is required when LLM_SCORING_PROVIDER=llm. " +
            "Set LLM_SCORING_PROVIDER=mock to use the deterministic mock provider.",
        );
      }
      return new LlmScoringProvider({ apiKey, model });
    }
    case "mock":
    default:
      return new MockScoringProvider();
  }
}

function resolveProviderName(): ScoringProviderName {
  const rawEnv = process.env.LLM_SCORING_PROVIDER;
  if (rawEnv == null || rawEnv === "") return "mock";
  const normalized = rawEnv.toLowerCase();
  if (normalized === "llm" || normalized === "mock") return normalized;
  console.warn(
    `[qa-scoring] Unrecognized LLM_SCORING_PROVIDER="${rawEnv}". ` +
      `Falling back to "mock". Valid values: "mock" | "llm".`,
  );
  return "mock";
}

export { MockScoringProvider } from "./mock-provider";
export { LlmScoringProvider } from "./llm-provider";
export type {
  ScoringCategoryResult,
  ScoringCoachingNote,
  ScoringInput,
  ScoringMessage,
  ScoringOutput,
  ScoringProvider,
  ScoringScorecard,
  ScoringCategory,
  ScoringCriterion,
} from "./types";
