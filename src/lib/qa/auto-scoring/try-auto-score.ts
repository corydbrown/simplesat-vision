import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/db/client";
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
import {
  pickScorecardAssignments,
  type ActorSignature,
  type ScorecardAssignment,
} from "./pick-scorecards";

/** Best-effort: fire-and-forget the auto-scoring engine for a ticket. Called
 *  inline from the ingest path the moment a ticket is upserted in a resolved
 *  state. Never throws — a scoring failure must not break ingest.
 *
 *  SVP-273 flipped this from "rules pick ONE scorecard" to "scorecards fan
 *  out, rules scope per-scorecard sampling":
 *   1. Build the ticket's `ActorSignature` (human turns? AI turns? assigned
 *      agent? bot identity?) from `tickets` + `ticket_messages`. The bot
 *      identity is NULL until SVP-269/1c lands; we use the `author_role +
 *      author_subtype` fallback in the meantime so AI-only conversations
 *      still flow through with `scored_team_member_id IS NULL`.
 *   2. Load every enabled, non-archived scorecard in the workspace AND
 *      every enabled auto-scoring rule. Each rule scopes ONE scorecard's
 *      filter/sampling/cap — a scorecard with no matching rule fires under
 *      the implicit "100% sampling, no cap, any ticket" default.
 *   3. Call the pure `pickScorecardAssignments` to decide which
 *      (scorecard, actor, rule?) pairs to score. The picker prunes by
 *      `scorecards.applies_to` against the actor signature: `human` only
 *      fires on human turns, `ai` only on bot turns, `resolution` always
 *      fires.
 *   4. For each surviving assignment, apply runtime gates (sampling, daily
 *      cap, idempotency) and then `scoreAndPersistTicket`. Sampling +
 *      caps + idempotency only apply when a rule is attached; ruleless
 *      assignments always proceed (the safety cap on AI/Resolution
 *      fan-out is a separate Phase 2a follow-up).
 *
 *  `ScoringPreconditionError` (unassigned ticket for a Human scorecard, no
 *  messages, etc.) is swallowed per-assignment — those are well-formed
 *  states that just shouldn't trigger that assignment. Everything else is
 *  logged and swallowed at the outer boundary.
 */
export async function tryAutoScore(
  workspaceId: string,
  ticketId: string,
): Promise<void> {
  try {
    const actorSig = await buildActorSignature(workspaceId, ticketId);
    if (!actorSig) return;

    const liveScorecards = await db
      .select({
        id: schema.scorecards.id,
        appliesTo: schema.scorecards.appliesTo,
      })
      .from(schema.scorecards)
      .where(
        and(
          eq(schema.scorecards.workspaceId, workspaceId),
          eq(schema.scorecards.enabled, true),
          isNull(schema.scorecards.archivedAt),
        ),
      );
    if (liveScorecards.length === 0) return;

    const rules = await listEnabledAutoScoringRules(workspaceId);
    const rulesByScorecardId = new Map<string, typeof rules>();
    for (const rule of rules) {
      const list = rulesByScorecardId.get(rule.scorecardId) ?? [];
      list.push(rule);
      rulesByScorecardId.set(rule.scorecardId, list);
    }

    // The picker calls `ticketMatchesPredicate` synchronously, but
    // `ticketMatchesRule` is async (it runs the same SQL the URL `?f=`
    // filters compile to). Pre-evaluate each predicate signature once.
    // Two rules with the same JSON predicate collapse to one cache key.
    const predicateMatchCache = new Map<string, boolean>();
    for (const rule of rules) {
      const key = JSON.stringify(rule.filterPredicate);
      if (predicateMatchCache.has(key)) continue;
      const matches = await ticketMatchesRule(
        ticketId,
        workspaceId,
        rule.filterPredicate,
      );
      predicateMatchCache.set(key, matches);
    }

    const assignments = pickScorecardAssignments(
      actorSig,
      liveScorecards,
      rulesByScorecardId,
      (predicate) =>
        predicateMatchCache.get(JSON.stringify(predicate)) ?? false,
    );

    for (const assignment of assignments) {
      await runAssignment(workspaceId, ticketId, assignment, rules);
    }
  } catch (err) {
    console.error(
      `[auto-score] failed for ticket ${ticketId} in workspace ${workspaceId}:`,
      err,
    );
  }
}

async function runAssignment(
  workspaceId: string,
  ticketId: string,
  assignment: ScorecardAssignment,
  rules: Awaited<ReturnType<typeof listEnabledAutoScoringRules>>,
): Promise<void> {
  // Human scorecards on an unassigned ticket: nothing to score against.
  // Quiet skip matches the pre-SVP-273 "Ticket has no assigned agent"
  // ScoringPreconditionError swallow behavior — same outcome (no row
  // written, no error surfaced), kept at the engine layer so the picker
  // stays pure.
  if (
    assignment.appliesTo === "human" &&
    assignment.scoredTeamMemberId === null
  ) {
    return;
  }

  const rule = assignment.autoScoringRuleId
    ? (rules.find((r) => r.id === assignment.autoScoringRuleId) ?? null)
    : null;

  if (rule) {
    if (Math.random() * 100 >= rule.samplingPercent) return;
    if (rule.dailyCap !== null) {
      const todayCount = await countEvaluationsForRuleToday(rule.id);
      if (todayCount >= rule.dailyCap) return;
    }
  }

  const alreadyScored = await evaluationExistsForTicketAndScorecard(
    ticketId,
    assignment.scorecardId,
  );
  if (alreadyScored) return;

  try {
    await scoreAndPersistTicket({
      workspaceId,
      ticketId,
      scorecardId: assignment.scorecardId,
      scoredTeamMemberId: assignment.scoredTeamMemberId,
      autoScoringRuleId: assignment.autoScoringRuleId,
    });
  } catch (err) {
    if (err instanceof ScoringPreconditionError) return;
    throw err;
  }
}

/** Build the ticket's `ActorSignature` from a single pass over its
 *  messages. Detects bot turns via either `team_members.kind='ai_agent'`
 *  (post-SVP-269/1c) OR `author_role='agent' + author_subtype='bot'`
 *  with NULL `team_member_id` (pre-1c). Returns null if the ticket
 *  doesn't exist — caller treats that as "nothing to score." */
export async function buildActorSignature(
  workspaceId: string,
  ticketId: string,
): Promise<ActorSignature | null> {
  const [ticket] = await db
    .select({ id: schema.tickets.id, teamMemberId: schema.tickets.teamMemberId })
    .from(schema.tickets)
    .where(
      and(
        eq(schema.tickets.id, ticketId),
        eq(schema.tickets.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!ticket) return null;

  const messageRows = await db
    .select({
      authorRole: schema.ticketMessages.authorRole,
      authorSubtype: schema.ticketMessages.authorSubtype,
      messageTeamMemberId: schema.ticketMessages.teamMemberId,
      teamMemberKind: schema.teamMembers.kind,
    })
    .from(schema.ticketMessages)
    .leftJoin(
      schema.teamMembers,
      eq(schema.teamMembers.id, schema.ticketMessages.teamMemberId),
    )
    .where(eq(schema.ticketMessages.ticketId, ticketId))
    .orderBy(asc(schema.ticketMessages.createdAt));

  let hasHumanTurns = false;
  let hasAiTurns = false;
  let aiTeamMemberId: string | null = null;

  for (const m of messageRows) {
    if (m.authorRole !== "agent") continue;
    const isBotById = m.teamMemberKind === "ai_agent";
    const isBotByFallback =
      m.authorSubtype === "bot" && m.messageTeamMemberId === null;
    if (isBotById || isBotByFallback) {
      hasAiTurns = true;
      if (aiTeamMemberId === null && isBotById && m.messageTeamMemberId) {
        aiTeamMemberId = m.messageTeamMemberId;
      }
    } else {
      hasHumanTurns = true;
    }
  }

  return {
    hasHumanTurns,
    hasAiTurns,
    assignedHumanId: ticket.teamMemberId ?? null,
    aiTeamMemberId,
  };
}
