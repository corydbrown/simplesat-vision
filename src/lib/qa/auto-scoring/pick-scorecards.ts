import type {
  AutoScoringRule,
  Scorecard,
  ScorecardAppliesTo,
} from "@/db/schema";
import type { Filter } from "@/lib/filters/types";

/** Snapshot of which actor types showed up in a ticket's transcript. Drives
 *  the `scorecards.applies_to` fan-out: human-scoring scorecards only run on
 *  tickets with human turns, AI-scoring scorecards only on tickets with bot
 *  turns, resolution-scoring scorecards on every ticket regardless. */
export type ActorSignature = {
  /** At least one `ticket_messages` row whose author is a human agent
   *  (resolved from `team_members.kind='human'`, or legacy `author_role='agent'`
   *  rows with `author_subtype != 'bot'`). */
  hasHumanTurns: boolean;
  /** At least one `ticket_messages` row whose author is a bot
   *  (`team_members.kind='ai_agent'`, OR the SVP-269/1c fallback
   *  `author_role='agent' + author_subtype='bot'` with NULL `team_member_id`). */
  hasAiTurns: boolean;
  /** The human currently assigned to the ticket (`tickets.team_member_id`).
   *  Used as the `scored_team_member_id` for `applies_to='human'`
   *  evaluations. NULL when the ticket is unassigned — caller decides
   *  whether to skip (today the engine swallows that as a precondition). */
  assignedHumanId: string | null;
  /** The first non-NULL `ticket_messages.team_member_id` on a bot-subtype
   *  turn. Used as the `scored_team_member_id` for `applies_to='ai'`
   *  evaluations. NULL pre-SVP-269/1c (no bot identity yet) — the eval
   *  row still writes, just with a NULL actor; backfills once 1c lands. */
  aiTeamMemberId: string | null;
};

/** One (scorecard, actor, rule) decision the engine should turn into an
 *  evaluation row. Idempotency + sampling + daily-cap gating live in the
 *  caller (they need a DB read and a randomness source — neither belongs
 *  in the pure picker). */
export type ScorecardAssignment = {
  scorecardId: string;
  appliesTo: ScorecardAppliesTo;
  scoredTeamMemberId: string | null;
  /** The rule that scoped this scorecard's eligibility (filter / sampling /
   *  cap). NULL when no rule targets the scorecard — that's the
   *  "100% sampling, no cap, all tickets eligible" default. */
  autoScoringRuleId: string | null;
};

type ScorecardPick = Pick<Scorecard, "id" | "appliesTo">;
type RulePick = Pick<
  AutoScoringRule,
  "id" | "scorecardId" | "priority" | "filterPredicate"
>;

/** Pure: decide which (scorecard, actor) pairs an auto-score run should
 *  produce for a single ticket. Doesn't gate sampling/cap/idempotency —
 *  the caller handles those because they require DB reads + randomness.
 *
 *  Per-scorecard decision:
 *   1. Prune by `appliesTo` vs `actorSig` (`resolution` always passes).
 *   2. If any rule targets the scorecard, walk rules in priority ASC
 *      order and attach the first whose predicate matches the ticket.
 *      No predicate match → scorecard pruned (a scorecard with rules is
 *      "gated by its rules"; missing all of them means it shouldn't fire).
 *      No rules at all → scorecard fires with `autoScoringRuleId: null`
 *      (the implicit "default rule": 100% sampling, no cap, any ticket).
 *   3. `scoredTeamMemberId` is derived from `appliesTo`:
 *        `human` → `actorSig.assignedHumanId`,
 *        `ai`    → `actorSig.aiTeamMemberId`,
 *        `resolution` → always `null`.
 */
export function pickScorecardAssignments(
  actorSig: ActorSignature,
  scorecards: ScorecardPick[],
  rulesByScorecardId: Map<string, RulePick[]>,
  ticketMatchesPredicate: (predicate: Filter[]) => boolean,
): ScorecardAssignment[] {
  const assignments: ScorecardAssignment[] = [];

  for (const scorecard of scorecards) {
    if (!appliesToMatchesSignature(scorecard.appliesTo, actorSig)) continue;

    const rules = rulesByScorecardId.get(scorecard.id) ?? [];
    let matchedRuleId: string | null = null;
    if (rules.length > 0) {
      const sorted = [...rules].sort((a, b) => a.priority - b.priority);
      const matched = sorted.find((rule) =>
        ticketMatchesPredicate((rule.filterPredicate ?? []) as Filter[]),
      );
      if (!matched) continue;
      matchedRuleId = matched.id;
    }

    assignments.push({
      scorecardId: scorecard.id,
      appliesTo: scorecard.appliesTo,
      scoredTeamMemberId: scoredTeamMemberFor(scorecard.appliesTo, actorSig),
      autoScoringRuleId: matchedRuleId,
    });
  }

  return assignments;
}

function appliesToMatchesSignature(
  appliesTo: ScorecardAppliesTo,
  actorSig: ActorSignature,
): boolean {
  switch (appliesTo) {
    case "human":
      return actorSig.hasHumanTurns;
    case "ai":
      return actorSig.hasAiTurns;
    case "resolution":
      return true;
  }
}

function scoredTeamMemberFor(
  appliesTo: ScorecardAppliesTo,
  actorSig: ActorSignature,
): string | null {
  switch (appliesTo) {
    case "human":
      return actorSig.assignedHumanId;
    case "ai":
      return actorSig.aiTeamMemberId;
    case "resolution":
      return null;
  }
}
