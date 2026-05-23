/**
 * Claude scoring provider — stub. Real LLM wiring is SVP-67.
 *
 * The interface is correct so that the seed and any app code paths that
 * select this provider via env compile and link today. The stub throws when
 * called, which is the right default: silently returning empty scores would
 * mask a misconfiguration in production.
 *
 * When SVP-67 lands, this file:
 *  - Instantiates the Anthropic SDK client (`@anthropic-ai/sdk` is already in
 *    the deps tree)
 *  - Issues one prompt per category per PRD Part 6 (parallel calls, JSON
 *    parsing) and one coaching synthesis call
 *  - Returns the same ScoringOutput shape the mock returns
 */

import type {
  ScoringInput,
  ScoringOutput,
  ScoringProvider,
} from "./types";

export class ClaudeScoringProvider implements ScoringProvider {
  readonly name = "claude-not-yet-wired";

  async scoreConversation(input: ScoringInput): Promise<ScoringOutput> {
    throw new Error(
      `ClaudeScoringProvider is not yet wired (would have scored ticket ${input.ticket.id}). ` +
        "Real LLM scoring lands at SVP-67. " +
        "Set QA_SCORING_PROVIDER=mock to use the deterministic mock provider for now.",
    );
  }
}
