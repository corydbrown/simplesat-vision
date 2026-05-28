import "server-only";
import { db, schema } from "@/db/client";
import { prefixedId } from "@/lib/ids";
import { DEFAULT_SCORECARD } from "@/lib/qa/default-scorecard";
import { snapshotScorecard } from "@/lib/scorecards/snapshot";
import type {
  NewScorecard,
  NewScorecardCategory,
  NewScorecardCriterion,
} from "@/db/schema";

export type InitializedDefaultScorecard = {
  scorecardId: string;
  scorecardVersionId: string;
  /** Per-category id, keyed by `DEFAULT_SCORECARD` category name. Returned
   *  because seed's downstream v2 bump targets the "Customer Connection"
   *  category by name without re-querying. */
  categoryIdByName: Map<string, string>;
  /** Per-category criterion ids in `DEFAULT_SCORECARD` order. Returned for the
   *  same seed-narrative reason as `categoryIdByName` — the v2 criterion-text
   *  rewrite needs the first criterion's id. */
  criterionIdsByCategoryName: Map<string, string[]>;
};

/**
 * Hydrate the default scorecard (rows + categories + criteria + v1 snapshot)
 * for one workspace. This is the single insertion path that both `seed.ts`
 * and the runtime auto-init in `scoreAndPersistTicket` go through, so seed
 * and runtime can never drift (per CLAUDE.md: seed runs through the app's
 * code paths).
 *
 * Idempotency is the caller's responsibility — the schema has no
 * `UNIQUE(workspace_id, is_default)` constraint, so an internal SELECT-then-
 * INSERT would still race. Runtime callers re-query after init; seed knows
 * it runs once on a fresh DB.
 */
export async function initDefaultScorecardForWorkspace(
  workspaceId: string,
  options: { createdAt?: Date } = {},
): Promise<InitializedDefaultScorecard> {
  const createdAt = options.createdAt ?? new Date();
  const scorecardId = prefixedId("sc");
  const scorecardRow: NewScorecard = {
    id: scorecardId,
    workspaceId,
    name: DEFAULT_SCORECARD.name,
    isDefault: DEFAULT_SCORECARD.isDefault,
    enabled: DEFAULT_SCORECARD.enabled,
    version: DEFAULT_SCORECARD.version,
    createdAt,
    updatedAt: createdAt,
  };

  const categoryRows: NewScorecardCategory[] = [];
  const criterionRows: NewScorecardCriterion[] = [];
  const categoryIdByName = new Map<string, string>();
  const criterionIdsByCategoryName = new Map<string, string[]>();

  DEFAULT_SCORECARD.categories.forEach((category, categoryIdx) => {
    const categoryId = prefixedId("scc");
    categoryIdByName.set(category.name, categoryId);
    categoryRows.push({
      id: categoryId,
      scorecardId,
      name: category.name,
      description: category.description,
      weightPercent: category.weightPercent,
      scaleType: category.scaleType,
      order: categoryIdx,
      isAutofail: category.isAutofail,
    });
    const criterionIds: string[] = [];
    category.criteria.forEach((criterion, criterionIdx) => {
      const criterionId = prefixedId("scr");
      criterionIds.push(criterionId);
      criterionRows.push({
        id: criterionId,
        categoryId,
        text: criterion.text,
        anchor5: criterion.anchor5,
        anchor3: criterion.anchor3,
        anchor1: criterion.anchor1,
        order: criterionIdx,
      });
    });
    criterionIdsByCategoryName.set(category.name, criterionIds);
  });

  const scorecardVersionId = await db.transaction(async (tx) => {
    await tx.insert(schema.scorecards).values(scorecardRow);
    await tx.insert(schema.scorecardCategories).values(categoryRows);
    await tx.insert(schema.scorecardCriteria).values(criterionRows);
    return snapshotScorecard(tx, {
      scorecardId,
      version: DEFAULT_SCORECARD.version,
      createdAt,
    });
  });

  return {
    scorecardId,
    scorecardVersionId,
    categoryIdByName,
    criterionIdsByCategoryName,
  };
}
