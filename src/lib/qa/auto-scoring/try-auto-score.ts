import "server-only";

import {
  countEvaluationsForRuleToday,
  evaluationExistsForTicketAndScorecard,
  listEnabledAutoScoringRules,
} from "@/db/queries/auto-scoring-rules";
import {
  scoreAndPersistTicket,
  ScoringPreconditionError,
} from "@/lib/qa/scoring/persist";
import { ticketMatchesRule } from "./match-rule";

/** Best-effort: fire-and-forget the auto-scoring engine for a ticket. Called
 *  inline from the ingest path the moment a ticket is upserted in a resolved
 *  state. Never throws — a scoring failure must not break ingest.
 *
 *  Flow:
 *   1. Walk enabled rules in priority order (lower wins).
 *   2. First rule whose `filter_predicate` matches the ticket *owns* it —
 *      including the sampling-out and cap-hit decisions. We do NOT fall
 *      through to lower-priority rules after sampling-out, because that
 *      would inflate the effective rate (a 50% rule + 100% fallback would
 *      score 100% of the 50% rule's tickets, defeating the whole point of
 *      ramped sampling).
 *   3. Idempotency: skip if (ticket, scorecard) already has an evaluation
 *      (helpdesks burst-resend webhooks on a single resolution event).
 *   4. Call `scoreAndPersistTicket` with the rule's scorecard + rule id.
 *
 *  `ScoringPreconditionError` (unassigned ticket, no messages, etc.) is
 *  swallowed — those are well-formed states that just shouldn't trigger
 *  auto-scoring. Everything else is logged and swallowed.
 */
export async function tryAutoScore(
  workspaceId: string,
  ticketId: string,
): Promise<void> {
  try {
    const rules = await listEnabledAutoScoringRules(workspaceId);
    for (const rule of rules) {
      const matches = await ticketMatchesRule(
        ticketId,
        workspaceId,
        rule.filterPredicate,
      );
      if (!matches) continue;

      // First match owns the ticket — see top-of-file rationale.
      if (Math.random() * 100 >= rule.samplingPercent) return;

      if (rule.dailyCap !== null) {
        const todayCount = await countEvaluationsForRuleToday(rule.id);
        if (todayCount >= rule.dailyCap) return;
      }

      const alreadyScored = await evaluationExistsForTicketAndScorecard(
        ticketId,
        rule.scorecardId,
      );
      if (alreadyScored) return;

      try {
        await scoreAndPersistTicket({
          workspaceId,
          ticketId,
          scorecardId: rule.scorecardId,
          autoScoringRuleId: rule.id,
        });
      } catch (err) {
        if (err instanceof ScoringPreconditionError) {
          // Expected: unassigned ticket, no messages, etc. Quiet skip.
          return;
        }
        throw err;
      }
      return;
    }
  } catch (err) {
    console.error(
      `[auto-score] failed for ticket ${ticketId} in workspace ${workspaceId}:`,
      err,
    );
  }
}
