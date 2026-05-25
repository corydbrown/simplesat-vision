import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "../client";

export type ScorecardSummary = {
  id: string;
  name: string;
  version: number;
  isDefault: boolean;
  enabled: boolean;
  categoryCount: number;
  criteriaCount: number;
  updatedAt: number;
};

/** Returns all scorecards with rollup counts. Phase 1 ships exactly one
 *  (the default), but the query shape is multi-row from the start so Phase 2
 *  doesn't need to refactor. */
export async function listScorecards(): Promise<ScorecardSummary[]> {
  const rows = await db
    .select({
      id: schema.scorecards.id,
      name: schema.scorecards.name,
      version: schema.scorecards.version,
      isDefault: schema.scorecards.isDefault,
      enabled: schema.scorecards.enabled,
      updatedAt: schema.scorecards.updatedAt,
      categoryCount: sql<number>`(
        SELECT COUNT(*) FROM "scorecard_categories"
        WHERE "scorecard_categories"."scorecard_id" = "scorecards"."id"
      )`,
      criteriaCount: sql<number>`(
        SELECT COUNT(*) FROM "scorecard_criteria"
        JOIN "scorecard_categories"
          ON "scorecard_criteria"."category_id" = "scorecard_categories"."id"
        WHERE "scorecard_categories"."scorecard_id" = "scorecards"."id"
      )`,
    })
    .from(schema.scorecards)
    .orderBy(asc(schema.scorecards.name));

  return rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.getTime() : r.updatedAt,
  }));
}

/** Returns the default scorecard summary, or null if no default is flagged. */
export async function getDefaultScorecard(): Promise<ScorecardSummary | null> {
  const all = await listScorecards();
  return all.find((s) => s.isDefault) ?? null;
}

export type ScorecardCategoryView = {
  id: string;
  name: string;
  description: string;
  weightPercent: number;
  isAutofail: boolean;
  order: number;
  criteriaCount: number;
};

/** Returns categories for a scorecard, ordered by `order`. Phase 2 will
 *  extend this to return full criteria + anchors when the editor needs them. */
export async function getScorecardCategories(
  scorecardId: string,
): Promise<ScorecardCategoryView[]> {
  const rows = await db
    .select({
      id: schema.scorecardCategories.id,
      name: schema.scorecardCategories.name,
      description: schema.scorecardCategories.description,
      weightPercent: schema.scorecardCategories.weightPercent,
      isAutofail: schema.scorecardCategories.isAutofail,
      order: schema.scorecardCategories.order,
      criteriaCount: sql<number>`(
        SELECT COUNT(*) FROM "scorecard_criteria"
        WHERE "scorecard_criteria"."category_id" = "scorecard_categories"."id"
      )`,
    })
    .from(schema.scorecardCategories)
    .where(eq(schema.scorecardCategories.scorecardId, scorecardId))
    .orderBy(asc(schema.scorecardCategories.order));

  return rows;
}
