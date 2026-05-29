import "server-only";
import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/db/client";
import { getAutoScoringRule } from "@/db/queries/auto-scoring-rules";
import {
  scoreAndPersistTicket,
  ScoringPreconditionError,
} from "@/lib/qa/scoring/persist";
import { listTicketIdsMatchingRule } from "./match-rule";
import { buildActorSignature } from "./try-auto-score";
import { pickScorecardAssignments } from "./pick-scorecards";

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
 *
 *  SVP-273: the per-ticket `scoredTeamMemberId` is now actor-aware. We
 *  rebuild the ticket's `ActorSignature` and run the same picker the
 *  ingest engine uses — scoped to JUST this rule's scorecard — so the
 *  resulting eval row pins the correct actor for AI/Resolution
 *  scorecards (NULL) instead of blindly using the ticket's assignee.
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

  // Load the rule's scorecard once — we need its `appliesTo` to run the
  // picker per-ticket. Archived scorecards shouldn't be reachable here
  // (the editor blocks routing rules at archived scorecards), but filter
  // defensively all the same.
  const [scorecard] = await db
    .select({
      id: schema.scorecards.id,
      appliesTo: schema.scorecards.appliesTo,
    })
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.id, rule.scorecardId),
        eq(schema.scorecards.workspaceId, workspaceId),
        isNull(schema.scorecards.archivedAt),
      ),
    )
    .limit(1);
  if (!scorecard) {
    throw new Error(
      `Scorecard ${rule.scorecardId} not found or archived in workspace`,
    );
  }

  const rulesForScorecard = new Map([[scorecard.id, [rule]]]);

  let scored = 0;
  let skipped = 0;
  let errors = 0;
  for (const ticketId of ticketIds) {
    const actorSig = await buildActorSignature(workspaceId, ticketId);
    if (!actorSig) {
      skipped++;
      continue;
    }
    const [assignment] = pickScorecardAssignments(
      actorSig,
      [scorecard],
      rulesForScorecard,
      () => true,
    );
    // `applies_to` doesn't match the ticket's actor signature (e.g. an
    // AI scorecard rule targeting a human-only ticket): nothing to score.
    // Counts as a skip — neither error nor success.
    if (!assignment) {
      skipped++;
      continue;
    }
    // Human assignment with no assignee → same precondition skip as
    // pre-SVP-273. The engine's runtime check (`runAssignment`) does the
    // same; mirror it here so /run-now stays consistent.
    if (
      assignment.appliesTo === "human" &&
      assignment.scoredTeamMemberId === null
    ) {
      skipped++;
      continue;
    }

    try {
      await scoreAndPersistTicket({
        workspaceId,
        ticketId,
        scorecardId: assignment.scorecardId,
        scoredTeamMemberId: assignment.scoredTeamMemberId,
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
