import "server-only";

import { getAutoScoringRule } from "@/db/queries/auto-scoring-rules";
import {
  scoreAndPersistTicket,
  ScoringPreconditionError,
} from "@/lib/qa/scoring/persist";
import { listTicketIdsMatchingRule } from "./match-rule";

export type RunRuleOnceResult = {
  scored: number;
  skipped: number;
  errors: number;
};

/** "Run now" backfill: scores every currently-eligible-not-yet-scored ticket
 *  that matches the rule's filter, up to the rule's daily cap (or a
 *  conservative default if no cap is set). Sampling is intentionally
 *  bypassed — this is an explicit user action, not the auto path.
 *
 *  Resolved-tickets-only: backfilling unresolved tickets doesn't match
 *  product intent (we score completed conversations, not in-flight ones).
 */
export async function runRuleOnce(
  workspaceId: string,
  ruleId: string,
): Promise<RunRuleOnceResult> {
  const rule = await getAutoScoringRule(workspaceId, ruleId);
  if (!rule) throw new Error(`Rule ${ruleId} not found in workspace`);

  // Default cap when none set: 100. Lets a user click Run Now without
  // accidentally scoring thousands of tickets if the predicate is wide
  // open. They can repeat the action to grind through more.
  const limit = rule.dailyCap ?? 100;

  const ticketIds = await listTicketIdsMatchingRule(
    workspaceId,
    rule.filterPredicate,
    {
      excludeAlreadyScoredWith: rule.scorecardId,
      limit,
      resolvedOnly: true,
    },
  );

  let scored = 0;
  let skipped = 0;
  let errors = 0;
  for (const ticketId of ticketIds) {
    try {
      await scoreAndPersistTicket({
        workspaceId,
        ticketId,
        scorecardId: rule.scorecardId,
        autoScoringRuleId: rule.id,
      });
      scored++;
    } catch (err) {
      if (err instanceof ScoringPreconditionError) {
        skipped++;
        continue;
      }
      errors++;
      console.error(
        `[run-rule-once] error scoring ticket ${ticketId} for rule ${ruleId}:`,
        err,
      );
    }
  }
  return { scored, skipped, errors };
}
