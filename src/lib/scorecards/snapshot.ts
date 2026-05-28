import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { DEFAULT_SCORECARD } from "@/lib/qa/default-scorecard";
import { prefixedId } from "@/lib/ids";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

/** Capture the live rubric (categories + criteria) for a scorecard into a
 *  new immutable `scorecard_versions` snapshot. Call this *after* live-table
 *  edits have been applied — the snapshot reflects the rubric as of the
 *  version going live, which is what subsequent evaluations will read.
 *
 *  Returns the new `scorecard_versions.id` so callers can FK eval rows into
 *  it. Pass an open transaction to keep snapshot creation atomic with the
 *  save that triggered it. */
export async function snapshotScorecard(
  tx: Executor,
  params: {
    scorecardId: string;
    version: number;
    /** Optional override; falls back to the live `scorecards.name`. */
    name?: string;
    /** Optional override; falls back to the PRD default
     *  (`DEFAULT_SCORECARD.autoFailFloor`). When auto-fail floor becomes
     *  per-scorecard, plumb it through here. */
    autoFailFloor?: number;
    /** Override snapshot timestamp. Defaults to now — useful for backfill
     *  in seeds where the eval's `scoredAt` is in the past. */
    createdAt?: Date;
  },
): Promise<string> {
  const { scorecardId, version } = params;

  const [card] = await tx
    .select({
      id: schema.scorecards.id,
      name: schema.scorecards.name,
      scoringPhilosophy: schema.scorecards.scoringPhilosophy,
      bandDescriptors: schema.scorecards.bandDescriptors,
      domainContext: schema.scorecards.domainContext,
      toneExpectations: schema.scorecards.toneExpectations,
    })
    .from(schema.scorecards)
    .where(eq(schema.scorecards.id, scorecardId))
    .limit(1);
  if (!card) throw new Error(`Scorecard not found: ${scorecardId}`);

  const categories = await tx
    .select()
    .from(schema.scorecardCategories)
    .where(eq(schema.scorecardCategories.scorecardId, scorecardId))
    .orderBy(asc(schema.scorecardCategories.order));

  const categoryIds = categories.map((c) => c.id);
  const criteria = categoryIds.length === 0
    ? []
    : await tx
        .select()
        .from(schema.scorecardCriteria)
        .where(inArray(schema.scorecardCriteria.categoryId, categoryIds))
        .orderBy(asc(schema.scorecardCriteria.order));

  const versionId = prefixedId("scv");
  // SVP-228: snapshot the four LLM-context fields onto the version row so
  // historical evaluations can reconstruct exactly what the LLM was told for
  // this version, even after the live scorecard is edited.
  await tx.insert(schema.scorecardVersions).values({
    id: versionId,
    scorecardId,
    version,
    name: params.name ?? card.name,
    autoFailFloor: params.autoFailFloor ?? DEFAULT_SCORECARD.autoFailFloor,
    scoringPhilosophy: card.scoringPhilosophy,
    bandDescriptors: card.bandDescriptors,
    domainContext: card.domainContext,
    toneExpectations: card.toneExpectations,
    createdAt: params.createdAt ?? new Date(),
  });

  if (categories.length > 0) {
    const versionCategoryIdBySourceId = new Map<string, string>();
    const versionCategoryRows = categories.map((c) => {
      const id = prefixedId("svc");
      versionCategoryIdBySourceId.set(c.id, id);
      return {
        id,
        scorecardVersionId: versionId,
        sourceCategoryId: c.id,
        name: c.name,
        description: c.description,
        weightPercent: c.weightPercent,
        scaleType: c.scaleType,
        order: c.order,
        isAutofail: c.isAutofail,
      };
    });
    await tx.insert(schema.scorecardVersionCategories).values(versionCategoryRows);

    if (criteria.length > 0) {
      const versionCriterionRows = criteria.map((cr) => ({
        id: prefixedId("svr"),
        versionCategoryId: versionCategoryIdBySourceId.get(cr.categoryId)!,
        sourceCriterionId: cr.id,
        text: cr.text,
        anchor5: cr.anchor5,
        anchor3: cr.anchor3,
        anchor1: cr.anchor1,
        weightPercent: cr.weightPercent,
        order: cr.order,
      }));
      await tx
        .insert(schema.scorecardVersionCriteria)
        .values(versionCriterionRows);
    }
  }

  return versionId;
}
