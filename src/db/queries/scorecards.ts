import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "../client";
import { requireWorkspace } from "@/lib/workspace";
import type { ScorecardScaleType } from "@/db/schema";

export type ScorecardSummary = {
  id: string;
  name: string;
  version: number;
  enabled: boolean;
  archivedAt: number | null;
  categoryCount: number;
  criteriaCount: number;
  updatedAt: number;
};

/** Returns all scorecards with rollup counts. Phase 1 ships exactly one
 *  (IQS), but the query shape is multi-row from the start so SVP-229's
 *  multi-scorecard UI doesn't need to refactor. */
export async function listScorecards(): Promise<ScorecardSummary[]> {
  const workspaceId = await requireWorkspace();
  const rows = await db
    .select({
      id: schema.scorecards.id,
      name: schema.scorecards.name,
      version: schema.scorecards.version,
      enabled: schema.scorecards.enabled,
      archivedAt: schema.scorecards.archivedAt,
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
    .where(eq(schema.scorecards.workspaceId, workspaceId))
    .orderBy(asc(schema.scorecards.name));

  return rows.map((r) => ({
    ...r,
    archivedAt:
      r.archivedAt instanceof Date ? r.archivedAt.getTime() : r.archivedAt,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.getTime() : r.updatedAt,
  }));
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

/** Returns categories for a scorecard, ordered by `order`. Shape used by the
 *  read-only summary on `/settings/scorecards` and the Phase 1 stub. The
 *  editor uses {@link getScorecardEditorView} which inlines full criteria. */
export async function getScorecardCategories(
  scorecardId: string,
): Promise<ScorecardCategoryView[]> {
  const workspaceId = await requireWorkspace();
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
    .innerJoin(schema.scorecards, eq(schema.scorecards.id, schema.scorecardCategories.scorecardId))
    .where(
      and(
        eq(schema.scorecardCategories.scorecardId, scorecardId),
        eq(schema.scorecards.workspaceId, workspaceId),
      ),
    )
    .orderBy(asc(schema.scorecardCategories.order));

  return rows;
}

export type ScorecardCriterionView = {
  id: string;
  text: string;
  anchor5: string;
  anchor3: string;
  anchor1: string;
  /** Authoritative per-criterion weight (SVP-228). */
  weightPercent: number;
  order: number;
};

export type ScorecardEditorCategory = {
  id: string;
  name: string;
  description: string;
  weightPercent: number;
  scaleType: ScorecardScaleType;
  isAutofail: boolean;
  order: number;
  criteria: ScorecardCriterionView[];
};

export type ScorecardEditorView = {
  id: string;
  name: string;
  version: number;
  enabled: boolean;
  archivedAt: number | null;
  /** Scorecard-level LLM-context fields (SVP-228). Read by the live LLM
   *  provider; the SVP-229 editor UI surfaces them for the manager. */
  scoringPhilosophy: string | null;
  bandDescriptors: string[] | null;
  domainContext: string | null;
  toneExpectations: string | null;
  categories: ScorecardEditorCategory[];
};

/** Returns the full editable shape of a scorecard — categories with their
 *  criteria inline. Used by the editor at `/settings/scorecards/<id>`. */
export async function getScorecardEditorView(
  scorecardId: string,
): Promise<ScorecardEditorView | null> {
  const workspaceId = await requireWorkspace();
  const [head] = await db
    .select({
      id: schema.scorecards.id,
      name: schema.scorecards.name,
      version: schema.scorecards.version,
      enabled: schema.scorecards.enabled,
      archivedAt: schema.scorecards.archivedAt,
      scoringPhilosophy: schema.scorecards.scoringPhilosophy,
      bandDescriptors: schema.scorecards.bandDescriptors,
      domainContext: schema.scorecards.domainContext,
      toneExpectations: schema.scorecards.toneExpectations,
    })
    .from(schema.scorecards)
    .where(and(eq(schema.scorecards.id, scorecardId), eq(schema.scorecards.workspaceId, workspaceId)))
    .limit(1);
  if (!head) return null;

  const categoryRows = await db
    .select({
      id: schema.scorecardCategories.id,
      name: schema.scorecardCategories.name,
      description: schema.scorecardCategories.description,
      weightPercent: schema.scorecardCategories.weightPercent,
      scaleType: schema.scorecardCategories.scaleType,
      isAutofail: schema.scorecardCategories.isAutofail,
      order: schema.scorecardCategories.order,
    })
    .from(schema.scorecardCategories)
    .where(eq(schema.scorecardCategories.scorecardId, scorecardId))
    .orderBy(asc(schema.scorecardCategories.order));

  const criterionRows = await db
    .select({
      id: schema.scorecardCriteria.id,
      categoryId: schema.scorecardCriteria.categoryId,
      text: schema.scorecardCriteria.text,
      anchor5: schema.scorecardCriteria.anchor5,
      anchor3: schema.scorecardCriteria.anchor3,
      anchor1: schema.scorecardCriteria.anchor1,
      weightPercent: schema.scorecardCriteria.weightPercent,
      order: schema.scorecardCriteria.order,
    })
    .from(schema.scorecardCriteria)
    .innerJoin(
      schema.scorecardCategories,
      eq(schema.scorecardCategories.id, schema.scorecardCriteria.categoryId),
    )
    .where(eq(schema.scorecardCategories.scorecardId, scorecardId))
    .orderBy(asc(schema.scorecardCriteria.order));

  const criteriaByCategoryId = new Map<string, ScorecardCriterionView[]>();
  for (const c of criterionRows) {
    const list = criteriaByCategoryId.get(c.categoryId) ?? [];
    list.push({
      id: c.id,
      text: c.text,
      anchor5: c.anchor5,
      anchor3: c.anchor3,
      anchor1: c.anchor1,
      weightPercent: c.weightPercent,
      order: c.order,
    });
    criteriaByCategoryId.set(c.categoryId, list);
  }

  return {
    ...head,
    archivedAt:
      head.archivedAt instanceof Date
        ? head.archivedAt.getTime()
        : head.archivedAt,
    categories: categoryRows.map((cat) => ({
      ...cat,
      criteria: criteriaByCategoryId.get(cat.id) ?? [],
    })),
  };
}
