import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "../client";
import type {
  QaEvaluationStatus,
  ScorecardScaleType,
} from "../schema";

export type QaCategoryView = {
  categoryId: string;
  name: string;
  description: string;
  weightPercent: number;
  scaleType: ScorecardScaleType;
  order: number;
  isAutofail: boolean;
  aiScore: number;
  humanScore: number | null;
  effectiveScore: number;
  aiReasoning: string;
  highlightedMessageIds: string[];
};

export type QaCoachingView = {
  strengthPoints: string[];
  growthPoints: string[];
  exampleMessageIds: string[];
};

export type QaScorerView = {
  source: "ai" | "human";
  /** Display name. For AI: pretty-printed provider id ("Mock provider").
   *  For human: team member name. */
  displayName: string;
  rawModel: string;
};

export type QaEvaluationView = {
  id: string;
  ticketId: string;
  scorecardId: string;
  scorecardName: string;
  scorecardVersion: number;
  overallScore: number;
  status: QaEvaluationStatus;
  /** Provider's self-reported confidence, 0-100 (integer percent, as stored). */
  aiConfidence: number;
  aiReasoningSummary: string;
  scoredAt: Date;
  invalidatedReason: string | null;
  scorer: QaScorerView;
  categories: QaCategoryView[];
  coaching: QaCoachingView | null;
};

export async function getEvaluationForTicket(
  ticketId: string,
): Promise<QaEvaluationView | null> {
  const [evalRow] = await db
    .select({
      evaluation: schema.evaluations,
      scorecard: {
        id: schema.scorecards.id,
        name: schema.scorecards.name,
      },
    })
    .from(schema.evaluations)
    .leftJoin(
      schema.scorecards,
      eq(schema.scorecards.id, schema.evaluations.scorecardId),
    )
    .where(eq(schema.evaluations.ticketId, ticketId))
    // Order desc so once re-scoring or scorecard versioning produces a second
    // evaluation row (PRD D-3 / SVP-67), the latest surfaces. Today there's
    // only one row per ticket, but matching the SVP-55 tickets query keeps
    // the two paths consistent.
    .orderBy(desc(schema.evaluations.scoredAt))
    .limit(1);

  if (!evalRow) return null;

  const [categoryRows, coachingRow] = await Promise.all([
    db
      .select({
        score: schema.evaluationCategoryScores,
        category: {
          name: schema.scorecardCategories.name,
          description: schema.scorecardCategories.description,
          weightPercent: schema.scorecardCategories.weightPercent,
          scaleType: schema.scorecardCategories.scaleType,
          order: schema.scorecardCategories.order,
          isAutofail: schema.scorecardCategories.isAutofail,
        },
      })
      .from(schema.evaluationCategoryScores)
      .leftJoin(
        schema.scorecardCategories,
        eq(
          schema.scorecardCategories.id,
          schema.evaluationCategoryScores.categoryId,
        ),
      )
      .where(eq(schema.evaluationCategoryScores.evaluationId, evalRow.evaluation.id))
      .orderBy(asc(schema.scorecardCategories.order)),
    db
      .select()
      .from(schema.coachingNotes)
      .where(eq(schema.coachingNotes.evaluationId, evalRow.evaluation.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const categories: QaCategoryView[] = categoryRows.map((r) => ({
    categoryId: r.score.categoryId,
    name: r.category?.name ?? "Unknown",
    description: r.category?.description ?? "",
    weightPercent: r.category?.weightPercent ?? 0,
    scaleType: r.category?.scaleType ?? "likert_5",
    order: r.category?.order ?? 0,
    isAutofail: r.category?.isAutofail ?? false,
    aiScore: r.score.aiScore,
    humanScore: r.score.humanScore,
    effectiveScore: r.score.effectiveScore,
    aiReasoning: r.score.aiReasoning,
    highlightedMessageIds: r.score.highlightedMessageIds,
  }));

  const coaching: QaCoachingView | null = coachingRow
    ? {
        strengthPoints: coachingRow.strengthPoints,
        growthPoints: coachingRow.growthPoints,
        exampleMessageIds: coachingRow.exampleMessageIds,
      }
    : null;

  const scorer = resolveScorer(evalRow.evaluation.aiModel);

  return {
    id: evalRow.evaluation.id,
    ticketId: evalRow.evaluation.ticketId,
    scorecardId: evalRow.evaluation.scorecardId,
    scorecardName: evalRow.scorecard?.name ?? "Scorecard",
    scorecardVersion: evalRow.evaluation.scorecardVersion,
    overallScore: evalRow.evaluation.overallScore,
    status: evalRow.evaluation.status,
    aiConfidence: evalRow.evaluation.aiConfidence,
    aiReasoningSummary: evalRow.evaluation.aiReasoningSummary,
    scoredAt: evalRow.evaluation.scoredAt,
    invalidatedReason: evalRow.evaluation.invalidatedReason,
    scorer,
    categories,
    coaching,
  };
}

function resolveScorer(rawModel: string): QaScorerView {
  if (rawModel.startsWith("mock")) {
    return { source: "ai", displayName: "Mock provider", rawModel };
  }
  if (rawModel.startsWith("claude")) {
    return { source: "ai", displayName: "Claude", rawModel };
  }
  return { source: "ai", displayName: "AI", rawModel };
}
