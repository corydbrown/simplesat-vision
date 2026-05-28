/**
 * LLM pricing in USD per 1M tokens, snapshotted at evaluation time so historical
 * costs survive vendor price changes.
 *
 * Update on every provider price change. Each entry carries an `effectiveFrom`
 * date so older entries can be kept side-by-side once prices change — the
 * lookup picks the latest entry whose `effectiveFrom` is on or before the
 * snapshot timestamp.
 *
 * Last reviewed: 2026-05-28 (verify against vendor pricing pages on every edit).
 *
 * Sources:
 *  - Anthropic: https://platform.claude.com/docs/en/docs/about-claude/pricing
 *
 * OpenAI / Gemini entries are intentionally omitted until a live provider for
 * those vendors is wired in. Better to return null and have the UI render
 * "Scored by <model>" without a fabricated cost than to ship guesses.
 */

export type ModelPriceEntry = {
  provider: string;
  /** Provider model identifier as it appears in evaluations.ai_model. */
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  /** ISO date (YYYY-MM-DD) the price became effective. The lookup chooses the
   *  most recent entry whose `effectiveFrom <= snapshot timestamp`. */
  effectiveFrom: string;
};

export const MODEL_PRICING: readonly ModelPriceEntry[] = [
  // Anthropic — sourced from
  // https://platform.claude.com/docs/en/docs/about-claude/pricing (2026-05-28).
  // Opus 4.5 / 4.6 / 4.7 share a price band; Sonnet 4.5 / 4.6 share theirs.
  { provider: "anthropic", model: "claude-opus-4-7",   inputPer1M: 5,  outputPer1M: 25, effectiveFrom: "2026-01-01" },
  { provider: "anthropic", model: "claude-opus-4-6",   inputPer1M: 5,  outputPer1M: 25, effectiveFrom: "2026-01-01" },
  { provider: "anthropic", model: "claude-opus-4-5",   inputPer1M: 5,  outputPer1M: 25, effectiveFrom: "2026-01-01" },
  { provider: "anthropic", model: "claude-opus-4-1",   inputPer1M: 15, outputPer1M: 75, effectiveFrom: "2026-01-01" },
  { provider: "anthropic", model: "claude-sonnet-4-6", inputPer1M: 3,  outputPer1M: 15, effectiveFrom: "2026-01-01" },
  { provider: "anthropic", model: "claude-sonnet-4-5", inputPer1M: 3,  outputPer1M: 15, effectiveFrom: "2026-01-01" },
  { provider: "anthropic", model: "claude-haiku-4-5",  inputPer1M: 1,  outputPer1M: 5,  effectiveFrom: "2026-01-01" },
];

/**
 * Estimate evaluation cost in integer USD cents from token counts. Returns
 * null when (a) no price entry matches the (provider, model) pair as of
 * `now`, or (b) either token count is non-finite. Cents-as-integer keeps the
 * DB column an int and dodges floating-point drift on rollup sums.
 *
 * Callers should NOT fabricate a cost on null — surface "unknown" in the UI
 * instead. That's the honest answer when a model isn't on the pricing list
 * yet, and it's the signal we use to remind ourselves to update this file.
 */
export function estimateCostCents(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  now: Date = new Date(),
): number | null {
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    return null;
  }
  const entry = findActivePrice(provider, model, now);
  if (!entry) return null;
  const usd =
    (inputTokens * entry.inputPer1M + outputTokens * entry.outputPer1M) /
    1_000_000;
  return Math.round(usd * 100);
}

function findActivePrice(
  provider: string,
  model: string,
  now: Date,
): ModelPriceEntry | null {
  const nowIso = now.toISOString().slice(0, 10);
  let best: ModelPriceEntry | null = null;
  for (const entry of MODEL_PRICING) {
    if (entry.provider !== provider) continue;
    if (entry.model !== model) continue;
    if (entry.effectiveFrom > nowIso) continue;
    if (!best || entry.effectiveFrom > best.effectiveFrom) best = entry;
  }
  return best;
}
