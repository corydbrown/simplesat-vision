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

/** Shape of a code-defined scorecard — the in-repo source of truth that the
 *  installer (`installCodeDefinedScorecard`) hydrates into the live tables +
 *  v1 snapshot. Both IQS (`default-scorecard.ts`) and Aprikot
 *  (`aprikot-scorecard.ts`) export an instance of this type. */
export type CodeDefinedScorecardCriterion = {
  text: string;
  /** Optional reference text (key factors / scoring-guide bullets). Stored on
   *  the criterion description in production schemas; for now we keep it on
   *  the spec only — surfaces consume the in-code constant directly. */
  description?: string;
  anchor5: string;
  anchor3: string;
  anchor1: string;
  /** Criterion-level weight (0-100). Non-autofail criterion weights across
   *  the whole scorecard must sum to 100. Autofail criteria are weight 0 —
   *  they contribute via the floor mechanism, not the average. */
  weightPercent: number;
};

export type CodeDefinedScorecardCategory = {
  name: string;
  description: string;
  /** Transitional / derived: equals `SUM(criteria.weightPercent)`. Kept until
   *  category-weight reads swap onto the derived expression. */
  weightPercent: number;
  scaleType: ScorecardScaleType;
  isAutofail: boolean;
  criteria: CodeDefinedScorecardCriterion[];
};

export type CodeDefinedScorecard = {
  name: string;
  enabled: true;
  version: number;
  /** Auto-fail floor: when any binary auto-fail criterion fails, the
   *  evaluation's overall score is clamped to this value. */
  autoFailFloor: number;
  /** Manager's framing of how the rubric should be applied. Markdown.
   *  LLM-only: consumed when the live provider assembles its scoring prompt. */
  scoringPhilosophy: string;
  /** Per-likert-level descriptors in ascending order (index 0 = score 1,
   *  index 4 = score 5). LLM-only. */
  bandDescriptors: [string, string, string, string, string];
  /** Industry / company / product context the LLM should hold while scoring.
   *  Markdown. LLM-only. */
  domainContext: string;
  /** Voice / tone expectations the LLM should weigh when judging
   *  communication. Markdown. LLM-only. */
  toneExpectations: string;
  categories: CodeDefinedScorecardCategory[];
};

/** Module-load invariant: non-autofail criterion weights sum to 100. Throws
 *  if the spec drifts out of shape — catches typos in the rubric files before
 *  they reach seed / runtime. */
export function assertCodeDefinedScorecardWeights(
  spec: CodeDefinedScorecard,
  label: string,
): void {
  const sum = spec.categories
    .filter((c) => !c.isAutofail)
    .flatMap((c) => c.criteria)
    .reduce((acc, cr) => acc + cr.weightPercent, 0);
  if (sum !== 100) {
    throw new Error(
      `${label} criterion weights for non-autofail criteria must sum to 100 (got ${sum}).`,
    );
  }
}

export type InstalledScorecard = {
  scorecardId: string;
  scorecardVersionId: string;
  /** Per-category id, keyed by the spec's category name. Returned because
   *  seed's v2 bump targets a category by name without re-querying. */
  categoryIdByName: Map<string, string>;
  /** Per-category criterion ids in spec order. */
  criterionIdsByCategoryName: Map<string, string[]>;
};

/** Hydrate a code-defined scorecard (rows + categories + criteria + v1
 *  snapshot) for one workspace. Single insertion path for every code-defined
 *  rubric — IQS init, Aprikot install, and any future scorecard go through
 *  here so seed and runtime can never drift.
 *
 *  Idempotency is the caller's responsibility — `scorecards` has no
 *  workspace-uniqueness constraint (a workspace may host many scorecards), so
 *  an internal SELECT-then-INSERT would still race. Callers that need
 *  idempotency check first and skip (see `installAprikotScorecard`). */
export async function installCodeDefinedScorecard(
  workspaceId: string,
  spec: CodeDefinedScorecard,
  options: { createdAt?: Date } = {},
): Promise<InstalledScorecard> {
  const createdAt = options.createdAt ?? new Date();
  const scorecardId = prefixedId("sc");
  const scorecardRow: NewScorecard = {
    id: scorecardId,
    workspaceId,
    name: spec.name,
    enabled: spec.enabled,
    version: spec.version,
    archivedAt: null,
    scoringPhilosophy: spec.scoringPhilosophy,
    bandDescriptors: spec.bandDescriptors,
    domainContext: spec.domainContext,
    toneExpectations: spec.toneExpectations,
    createdAt,
    updatedAt: createdAt,
  };

  const categoryRows: NewScorecardCategory[] = [];
  const criterionRows: NewScorecardCriterion[] = [];
  const categoryIdByName = new Map<string, string>();
  const criterionIdsByCategoryName = new Map<string, string[]>();

  spec.categories.forEach((category, categoryIdx) => {
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
        weightPercent: criterion.weightPercent,
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
      version: spec.version,
      autoFailFloor: spec.autoFailFloor,
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
