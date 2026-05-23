/**
 * Public entry point for QA scoring. Callers in seed code and route
 * handlers go through `getScoringProvider()` rather than constructing a
 * provider directly — that keeps the choice of mock vs Claude in one place
 * (the env var) and the swap to real LLM scoring (SVP-67) is a one-line
 * config change, not a code search.
 *
 * Env: QA_SCORING_PROVIDER=mock|claude (default: mock).
 */

import { ClaudeScoringProvider } from "./claude-provider";
import { MockScoringProvider } from "./mock-provider";
import type { ScoringProvider } from "./types";

export type ScoringProviderName = "mock" | "claude";

export function getScoringProvider(
  override?: ScoringProviderName,
): ScoringProvider {
  const name = override ?? resolveProviderName();
  switch (name) {
    case "claude":
      return new ClaudeScoringProvider();
    case "mock":
    default:
      return new MockScoringProvider();
  }
}

function resolveProviderName(): ScoringProviderName {
  const raw = (process.env.QA_SCORING_PROVIDER ?? "mock").toLowerCase();
  if (raw === "claude") return "claude";
  return "mock";
}

export { MockScoringProvider } from "./mock-provider";
export { ClaudeScoringProvider } from "./claude-provider";
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
