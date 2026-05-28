import "server-only";
import { db, schema } from "@/db/client";
import { prefixedId } from "@/lib/ids";
import { snapshotScorecard } from "@/lib/scorecards/snapshot";
import type {
  NewScorecard,
  NewScorecardCategory,
  NewScorecardCriterion,
  ScorecardScaleType,
} from "@/db/schema";

export type ScorecardMintTemplate = {
  name: string;
  enabled: boolean;
  version: number;
  scoringPhilosophy: string | null;
  bandDescriptors: string[] | null;
  domainContext: string | null;
  toneExpectations: string | null;
  categories: Array<{
    name: string;
    description: string;
    weightPercent: number;
    scaleType: ScorecardScaleType;
    isAutofail: boolean;
    criteria: Array<{
      text: string;
      anchor5: string;
      anchor3: string;
      anchor1: string;
      weightPercent: number;
    }>;
  }>;
};

export type MintedScorecard = {
  scorecardId: string;
  scorecardVersionId: string;
  /** Per-category id in template order. */
  categoryIds: string[];
  /** Per-criterion id in template order, grouped by category. */
  criterionIdsByCategoryIndex: string[][];
};

/** Insert a fresh scorecard (rows + categories + criteria + v1 snapshot) for a
 *  workspace from a generic template. Both the default-init path and the
 *  SVP-229 "New scorecard" / "Duplicate" actions go through this helper so
 *  every minted scorecard has the same v1 snapshot guarantee. */
export async function mintScorecardFromTemplate(params: {
  workspaceId: string;
  template: ScorecardMintTemplate;
  createdAt?: Date;
}): Promise<MintedScorecard> {
  const createdAt = params.createdAt ?? new Date();
  const { workspaceId, template } = params;

  const scorecardId = prefixedId("sc");
  const scorecardRow: NewScorecard = {
    id: scorecardId,
    workspaceId,
    name: template.name,
    enabled: template.enabled,
    version: template.version,
    archivedAt: null,
    scoringPhilosophy: template.scoringPhilosophy,
    bandDescriptors: template.bandDescriptors,
    domainContext: template.domainContext,
    toneExpectations: template.toneExpectations,
    createdAt,
    updatedAt: createdAt,
  };

  const categoryRows: NewScorecardCategory[] = [];
  const criterionRows: NewScorecardCriterion[] = [];
  const categoryIds: string[] = [];
  const criterionIdsByCategoryIndex: string[][] = [];

  template.categories.forEach((category, categoryIdx) => {
    const categoryId = prefixedId("scc");
    categoryIds.push(categoryId);
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
        weightPercent: criterion.weightPercent,
        order: criterionIdx,
      });
    });
    criterionIdsByCategoryIndex.push(criterionIds);
  });

  const scorecardVersionId = await db.transaction(async (tx) => {
    await tx.insert(schema.scorecards).values(scorecardRow);
    if (categoryRows.length > 0) {
      await tx.insert(schema.scorecardCategories).values(categoryRows);
    }
    if (criterionRows.length > 0) {
      await tx.insert(schema.scorecardCriteria).values(criterionRows);
    }
    return snapshotScorecard(tx, {
      scorecardId,
      version: template.version,
      createdAt,
    });
  });

  return {
    scorecardId,
    scorecardVersionId,
    categoryIds,
    criterionIdsByCategoryIndex,
  };
}
