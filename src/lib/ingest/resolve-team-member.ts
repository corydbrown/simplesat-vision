import type {
  SourceAgents,
  TeamMemberResolutionRule,
} from "@/db/schema";

/** The default resolution rule. A workspace setting will own this later
 *  (decision #4 in the ingest mapping doc); today every workspace resolves
 *  the credited team member from the source's `assignee` role. */
export const DEFAULT_RESOLUTION_RULE: TeamMemberResolutionRule = "assignee";

/**
 * Pick the single credited team member's *source* external id from a ticket's
 * lossless `sourceAgents` bag, per a resolution `rule`.
 *
 * This is deliberately pure and source-neutral: it returns the raw external id
 * stored under the rule's role key, or `null` if the source didn't provide
 * that role. Mapping that external id to our `team_members.id` (via
 * `team_members.externalId`) is the caller's job — see `seed.ts` and, later,
 * the ingest API. Keeping resolution in our app (not in n8n) means changing
 * the rule re-resolves already-imported tickets against the stored bag.
 *
 * Forward-compat: when multiple credited members per ticket lands, this
 * resolver grows a sibling that returns the full set (one per role) feeding a
 * `ticket_team_members` join table; this single-pick function stays as the
 * `is_primary` selector. See DECISIONS.md.
 */
export function resolveTeamMember(
  sourceAgents: SourceAgents,
  rule: TeamMemberResolutionRule = DEFAULT_RESOLUTION_RULE,
): string | null {
  return sourceAgents[rule] ?? null;
}
