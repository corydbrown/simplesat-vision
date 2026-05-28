import "server-only";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db/client";
import { prefixedId } from "@/lib/ids";

export const DEFAULT_AUTO_SCORING_RULE_NAME = "Score all tickets with IQS";
export const DEFAULT_AUTO_SCORING_DAILY_CAP = 500;

/** Ensure a workspace has at least one auto-scoring rule. Idempotent —
 *  returns without inserting if any rule already exists for the workspace,
 *  including a rule the user has since renamed or repointed. We deliberately
 *  do NOT match by name or scorecardId: once a user touches their rules,
 *  the seed default is their problem to manage, not ours to re-mint.
 *
 *  Called from:
 *   - seed.ts after the IQS scorecard is hydrated for Bloom Beauty
 *   - `initDefaultScorecardForWorkspace` so any code path that lazily mints
 *     a scorecard also gets a usable default rule
 *   - the workspace-creation flow (future) — same idempotency keeps it safe
 *     if the call chain ever gets reordered
 */
export async function ensureDefaultAutoScoringRule(
  workspaceId: string,
  scorecardId: string,
): Promise<string | null> {
  const [existing] = await db
    .select({ id: schema.autoScoringRules.id })
    .from(schema.autoScoringRules)
    .where(eq(schema.autoScoringRules.workspaceId, workspaceId))
    .limit(1);
  if (existing) return existing.id;

  const id = prefixedId("asr");
  await db.insert(schema.autoScoringRules).values({
    id,
    workspaceId,
    name: DEFAULT_AUTO_SCORING_RULE_NAME,
    enabled: true,
    filterPredicate: [],
    scorecardId,
    samplingPercent: 100,
    dailyCap: DEFAULT_AUTO_SCORING_DAILY_CAP,
    priority: 100,
    createdBy: null,
  });
  return id;
}
