import "server-only";
import { DEFAULT_SCORECARD } from "@/lib/qa/default-scorecard";
import {
  installCodeDefinedScorecard,
  type InstalledScorecard,
} from "@/lib/qa/scorecard-spec";

export type InitializedDefaultScorecard = InstalledScorecard;

/**
 * Hydrate the IQS scorecard (rows + categories + criteria + v1 snapshot) for
 * one workspace. Thin wrapper over `installCodeDefinedScorecard`, retained
 * because both `seed.ts` and the runtime auto-init in `scoreAndPersistTicket`
 * call this name. Idempotency is the caller's responsibility — seed runs once
 * on a fresh DB, runtime re-queries after init.
 *
 * Note: SVP-229 added a sibling helper `mintScorecardFromTemplate` for the
 * editor's create / duplicate flows. Both helpers do the same insertion shape;
 * a follow-up task should consolidate them. For now: code-defined rubrics
 * (IQS, Aprikot) go through installCodeDefinedScorecard; user-driven mints
 * (createScorecard, duplicateScorecard) go through mintScorecardFromTemplate.
 */
export function initDefaultScorecardForWorkspace(
  workspaceId: string,
  options: { createdAt?: Date } = {},
): Promise<InitializedDefaultScorecard> {
  return installCodeDefinedScorecard(workspaceId, DEFAULT_SCORECARD, options);
}
