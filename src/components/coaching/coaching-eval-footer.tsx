import { formatCurrencyCents, formatNumber } from "@/lib/format";
import type { CoachingEvaluationView } from "@/db/queries/coaching";

/**
 * Footer line below the coaching detail surface — answers "what model scored
 * this, how many tokens did it burn, and what did it cost?" (SVP-233). Cost +
 * token counts are null for mock-scored evaluations and for rows produced
 * before SVP-233 shipped; in that case only the model is shown rather than
 * surfacing "0 tokens · $0.00", which would read as a cost claim.
 */
export function CoachingEvalFooter({
  evaluation,
}: {
  evaluation: Pick<
    CoachingEvaluationView,
    "aiModel" | "inputTokens" | "outputTokens" | "costUsdCents"
  >;
}) {
  const { aiModel, inputTokens, outputTokens, costUsdCents } = evaluation;
  const totalTokens =
    inputTokens !== null && outputTokens !== null
      ? inputTokens + outputTokens
      : null;

  const parts: string[] = [`Scored by ${aiModel}`];
  if (totalTokens !== null) parts.push(`${formatNumber(totalTokens)} tokens`);
  if (costUsdCents !== null) parts.push(formatCurrencyCents(costUsdCents));

  return (
    <footer className="mt-10 border-t border-border pt-4 text-base text-muted-foreground">
      {parts.join(" · ")}
    </footer>
  );
}
