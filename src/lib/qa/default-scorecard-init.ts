import "server-only";
import { ensureDefaultAutoScoringRule } from "@/lib/qa/auto-scoring/default-rule";
import { DEFAULT_SCORECARD } from "@/lib/qa/default-scorecard";
import {
  installCodeDefinedScorecard,
  type InstalledScorecard,
} from "@/lib/qa/scorecard-spec";

export type InitializedDefaultScorecard = InstalledScorecard;

/**
 * Hydrate the IQS scorecard (rows + categories + criteria + v1 snapshot) for
 * one workspace, plus mint the workspace's default auto-scoring rule pointing
 * at it. Thin wrapper over `installCodeDefinedScorecard` + the SVP-232
 * default-rule helper, retained because both `seed.ts` and the runtime
 * auto-init in `scoreAndPersistTicket` call this name. Idempotency is the
 * caller's responsibility for the scorecard install; the default-rule helper
 * is idempotent on its own (won't re-mint if any rule already exists).
 *
 * Note: SVP-229 added a sibling helper `mintScorecardFromTemplate` for the
 * editor's create / duplicate flows. Both helpers do the same insertion shape;
 * a follow-up task should consolidate them. For now: code-defined rubrics
 * (IQS, Aprikot) go through installCodeDefinedScorecard; user-driven mints
 * (createScorecard, duplicateScorecard) go through mintScorecardFromTemplate.
 */
export async function initDefaultScorecardForWorkspace(
  workspaceId: string,
  options: { createdAt?: Date } = {},
): Promise<InitializedDefaultScorecard> {
  const installed = await installCodeDefinedScorecard(
    workspaceId,
    DEFAULT_SCORECARD,
    options,
  );
  // SVP-232: ensure every workspace that has a default scorecard also has
  // a default rule pointing at it. Idempotent — no-op when a rule already
  // exists (e.g. migration backfilled it earlier).
  await ensureDefaultAutoScoringRule(workspaceId, installed.scorecardId);
  return installed;
}
