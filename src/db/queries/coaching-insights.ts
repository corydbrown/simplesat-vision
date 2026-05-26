import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sliding window over the most recent `windowDays`. The delta variant compares
 *  the most recent `windowDays` to the equally-sized window immediately before
 *  it (so a 30-day delta covers days 0-30 vs 30-60 from now). */
export type Period = { from: number; to: number };

function windowsRelativeToNow(windowDays: number): {
  current: Period;
  prior: Period;
} {
  const now = Date.now();
  const span = windowDays * DAY_MS;
  return {
    current: { from: now - span, to: now },
    prior: { from: now - 2 * span, to: now - span },
  };
}

// ---------------------------------------------------------------------------
// 1. Top-of-page tiles
// ---------------------------------------------------------------------------

export type CoachingInsightsTiles = {
  avgScore: {
    current: number | null;
    prior: number | null;
    delta: number | null;
  };
  percentEvaluated: {
    evaluatedTickets: number;
    eligibleTickets: number;
    pct: number | null;
  };
  avgCsat: {
    current: number | null;
    prior: number | null;
    delta: number | null;
    scale: number;
  };
  aiAccuracy: {
    pct: number | null;
    sampleSize: number;
  };
};

/** "Latest evaluation per ticket": filter to the row with the max scoredAt for
 *  each ticket, excluding invalidated rows. Used as a CTE in several places. */
const LATEST_EVAL_CTE = sql`
  latest_evals AS (
    SELECT e.*
    FROM evaluations e
    WHERE e.status != 'invalidated'
      AND e.scored_at = (
        SELECT MAX(e2.scored_at)
        FROM evaluations e2
        WHERE e2.ticket_id = e.ticket_id
          AND e2.status != 'invalidated'
      )
  )
`;

export async function getCoachingInsightsTiles(): Promise<CoachingInsightsTiles> {
  const { current, prior } = windowsRelativeToNow(30);

  // Avg QA score — current vs prior window (latest eval per ticket, scored within window)
  const scoreRows = await db.all<{
    current_avg: number | null;
    prior_avg: number | null;
  }>(sql`
    WITH ${LATEST_EVAL_CTE}
    SELECT
      AVG(CASE WHEN scored_at >= ${current.from} AND scored_at < ${current.to}
        THEN CAST(overall_score AS REAL) END) AS current_avg,
      AVG(CASE WHEN scored_at >= ${prior.from} AND scored_at < ${prior.to}
        THEN CAST(overall_score AS REAL) END) AS prior_avg
    FROM latest_evals
  `);
  const scoreRow = scoreRows[0];

  // % evaluated — all-time: count of distinct tickets with a latest eval / count of solved|closed tickets
  const pctRows = await db.all<{
    evaluated: number;
    eligible: number;
  }>(sql`
    SELECT
      (SELECT COUNT(DISTINCT ticket_id)
        FROM evaluations
        WHERE status != 'invalidated') AS evaluated,
      (SELECT COUNT(*)
        FROM tickets
        WHERE status IN ('solved', 'closed')) AS eligible
  `);
  const pctRow = pctRows[0];

  // Avg CSAT — over csat-style responses (rating with scale). Normalize to 5.
  const csatRows = await db.all<{
    current_avg: number | null;
    prior_avg: number | null;
  }>(sql`
    SELECT
      AVG(CASE WHEN responded_at >= ${current.from} AND responded_at < ${current.to}
        THEN CAST(rating AS REAL) * 5.0 / scale END) AS current_avg,
      AVG(CASE WHEN responded_at >= ${prior.from} AND responded_at < ${prior.to}
        THEN CAST(rating AS REAL) * 5.0 / scale END) AS prior_avg
    FROM responses
  `);
  const csatRow = csatRows[0];

  // AI accuracy — % of category scores where human_score equals ai_score
  // (only among rows where a human override exists at all). Sample size = N with override.
  const accuracyRows = await db.all<{
    matches: number;
    overrides: number;
  }>(sql`
    SELECT
      SUM(CASE WHEN human_score IS NOT NULL AND human_score = ai_score THEN 1 ELSE 0 END) AS matches,
      SUM(CASE WHEN human_score IS NOT NULL THEN 1 ELSE 0 END) AS overrides
    FROM evaluation_category_scores
  `);
  const accuracyRow = accuracyRows[0];

  const currentScore = scoreRow.current_avg;
  const priorScore = scoreRow.prior_avg;
  const currentCsat = csatRow.current_avg;
  const priorCsat = csatRow.prior_avg;
  const overrides = Number(accuracyRow.overrides ?? 0);
  const matches = Number(accuracyRow.matches ?? 0);
  const evaluated = Number(pctRow.evaluated ?? 0);
  const eligible = Number(pctRow.eligible ?? 0);

  return {
    avgScore: {
      current: currentScore == null ? null : Number(currentScore),
      prior: priorScore == null ? null : Number(priorScore),
      delta:
        currentScore != null && priorScore != null
          ? Number(currentScore) - Number(priorScore)
          : null,
    },
    percentEvaluated: {
      evaluatedTickets: evaluated,
      eligibleTickets: eligible,
      pct: eligible > 0 ? (evaluated / eligible) * 100 : null,
    },
    avgCsat: {
      current: currentCsat == null ? null : Number(currentCsat),
      prior: priorCsat == null ? null : Number(priorCsat),
      delta:
        currentCsat != null && priorCsat != null
          ? Number(currentCsat) - Number(priorCsat)
          : null,
      scale: 5,
    },
    aiAccuracy: {
      pct: overrides > 0 ? (matches / overrides) * 100 : null,
      sampleSize: overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Correlation buckets — QA-score buckets × avg CSAT of their tickets
// ---------------------------------------------------------------------------

export type CorrelationBucket = {
  bucket: "0-50" | "50-70" | "70-85" | "85-100";
  ticketCount: number;
  avgCsat: number | null;
};

const BUCKET_ORDER: CorrelationBucket["bucket"][] = [
  "0-50",
  "50-70",
  "70-85",
  "85-100",
];

export async function getCoachingCorrelationBuckets(): Promise<
  CorrelationBucket[]
> {
  const rows = await db.all<{
    bucket: CorrelationBucket["bucket"];
    ticket_count: number;
    avg_csat: number | null;
  }>(sql`
    WITH ${LATEST_EVAL_CTE},
    ticket_pairs AS (
      SELECT
        le.ticket_id,
        le.overall_score,
        CAST(r.rating AS REAL) * 5.0 / r.scale AS csat
      FROM latest_evals le
      LEFT JOIN responses r ON r.ticket_id = le.ticket_id
    )
    SELECT
      CASE
        WHEN overall_score < 50 THEN '0-50'
        WHEN overall_score < 70 THEN '50-70'
        WHEN overall_score < 85 THEN '70-85'
        ELSE '85-100'
      END AS bucket,
      COUNT(*) AS ticket_count,
      AVG(csat) AS avg_csat
    FROM ticket_pairs
    GROUP BY bucket
  `);

  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  return BUCKET_ORDER.map((bucket) => {
    const row = byBucket.get(bucket);
    return {
      bucket,
      ticketCount: row ? Number(row.ticket_count) : 0,
      avgCsat:
        row && row.avg_csat != null ? Number(row.avg_csat) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Heatmap — agents × scorecard categories
// ---------------------------------------------------------------------------

export type HeatmapAgent = {
  id: string;
  name: string;
  team: string;
  avatarColor: string;
  evaluationCount: number;
};

export type HeatmapCategory = {
  id: string;
  name: string;
  order: number;
};

export type HeatmapCellValue = {
  agentId: string;
  categoryId: string;
  avgScore: number;
  sampleSize: number;
};

export type CoachingHeatmap = {
  scorecardId: string | null;
  agents: HeatmapAgent[];
  categories: HeatmapCategory[];
  cells: HeatmapCellValue[];
};

export async function getCoachingHeatmap(): Promise<CoachingHeatmap> {
  // Default scorecard's categories
  const categories = await db.all<{
    id: string;
    name: string;
    scorecard_id: string;
    order: number;
  }>(sql`
    SELECT c.id, c.name, c.scorecard_id, c."order"
    FROM scorecard_categories c
    JOIN scorecards s ON s.id = c.scorecard_id
    WHERE s.is_default = 1
    ORDER BY c."order" ASC
  `);
  const scorecardId = categories[0]?.scorecard_id ?? null;

  // Agents with at least one (latest, non-invalidated) evaluation
  const agents = await db.all<{
    id: string;
    name: string;
    team: string;
    avatar_color: string;
    eval_count: number;
  }>(sql`
    WITH ${LATEST_EVAL_CTE}
    SELECT
      tm.id, tm.name, tm.team, tm.avatar_color,
      COUNT(le.id) AS eval_count
    FROM team_members tm
    JOIN latest_evals le ON le.scored_team_member_id = tm.id
    GROUP BY tm.id
    ORDER BY eval_count DESC, tm.name ASC
  `);

  // Cells — agent × category avg effective_score
  const cells = await db.all<{
    agent_id: string;
    category_id: string;
    avg_score: number;
    sample_size: number;
  }>(sql`
    WITH ${LATEST_EVAL_CTE}
    SELECT
      le.scored_team_member_id AS agent_id,
      ecs.category_id,
      AVG(CAST(ecs.effective_score AS REAL)) AS avg_score,
      COUNT(*) AS sample_size
    FROM latest_evals le
    JOIN evaluation_category_scores ecs ON ecs.evaluation_id = le.id
    GROUP BY le.scored_team_member_id, ecs.category_id
  `);

  return {
    scorecardId,
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      team: a.team,
      avatarColor: a.avatar_color,
      evaluationCount: Number(a.eval_count),
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      order: Number(c.order),
    })),
    cells: cells.map((c) => ({
      agentId: c.agent_id,
      categoryId: c.category_id,
      avgScore: Number(c.avg_score),
      sampleSize: Number(c.sample_size),
    })),
  };
}

// ---------------------------------------------------------------------------
// 4. Event signals
// ---------------------------------------------------------------------------

export type EventSignalVerb =
  | "escalated"
  | "sla_breached"
  | "ai_handoff"
  | "reassigned_multiple";

export type SignalActor = {
  id: string | null;
  name: string;
  count: number;
};

export type EventSignal = {
  verb: EventSignalVerb;
  label: string;
  /** Distinct tickets that experienced this signal at least once. */
  ticketCount: number;
  /** ticketCount / total tickets, 0..1. */
  ticketShare: number;
  /** Avg CSAT (5-scale) on signal tickets, minus overall avg CSAT. Null if
   *  not enough data on either side. */
  csatDelta: number | null;
  /** Top 3 actors associated with the signal. For most verbs this is the
   *  acting team member; for reassigned_multiple it's the previous assignee
   *  (i.e., the agent the ticket was reassigned OUT of). */
  topActors: SignalActor[];
};

const VERB_LABEL: Record<EventSignalVerb, string> = {
  escalated: "Tickets escalated",
  sla_breached: "Tickets that breached SLA",
  ai_handoff: "Tickets handed off from AI",
  reassigned_multiple: "Tickets reassigned 2+ times",
};

async function getTotalTickets(): Promise<number> {
  const rows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM tickets
  `);
  return Number(rows[0]?.n ?? 0);
}

async function getOverallAvgCsat(): Promise<number | null> {
  const rows = await db.all<{ avg: number | null }>(sql`
    SELECT AVG(CAST(rating AS REAL) * 5.0 / scale) AS avg FROM responses
  `);
  const v = rows[0]?.avg;
  return v == null ? null : Number(v);
}

/** For a single verb, count distinct tickets, csat delta, top actors. */
async function signalForVerb(
  verb: "escalated" | "sla_breached" | "ai_handoff",
  totalTickets: number,
  overallCsat: number | null,
): Promise<EventSignal> {
  const ticketRows = await db.all<{ ticket_id: string; avg_csat: number | null }>(sql`
    SELECT
      DISTINCT te.ticket_id,
      (SELECT AVG(CAST(r.rating AS REAL) * 5.0 / r.scale)
        FROM responses r
        WHERE r.ticket_id = te.ticket_id) AS avg_csat
    FROM ticket_events te
    WHERE te.verb = ${verb}
  `);
  const ticketCount = ticketRows.length;

  const csats = ticketRows
    .map((r) => r.avg_csat)
    .filter((v): v is number => v != null)
    .map(Number);
  const signalCsat =
    csats.length > 0 ? csats.reduce((a, b) => a + b, 0) / csats.length : null;
  const csatDelta =
    signalCsat != null && overallCsat != null ? signalCsat - overallCsat : null;

  const actorRows = await db.all<{
    actor_team_member_id: string | null;
    name: string | null;
    n: number;
  }>(sql`
    SELECT te.actor_team_member_id, tm.name, COUNT(*) AS n
    FROM ticket_events te
    LEFT JOIN team_members tm ON tm.id = te.actor_team_member_id
    WHERE te.verb = ${verb}
      AND te.actor_team_member_id IS NOT NULL
    GROUP BY te.actor_team_member_id
    ORDER BY n DESC
    LIMIT 3
  `);

  return {
    verb,
    label: VERB_LABEL[verb],
    ticketCount,
    ticketShare: totalTickets > 0 ? ticketCount / totalTickets : 0,
    csatDelta,
    topActors: actorRows.map((a) => ({
      id: a.actor_team_member_id,
      name: a.name ?? "Unknown",
      count: Number(a.n),
    })),
  };
}

/** Tickets that had >= 2 `assignee_changed` events. "Reassign-out" actors
 *  come from `previous_value` (the agent the ticket was moved away from). */
async function signalForReassignedMultiple(
  totalTickets: number,
  overallCsat: number | null,
): Promise<EventSignal> {
  const ticketRows = await db.all<{ ticket_id: string; avg_csat: number | null }>(sql`
    WITH reassigned AS (
      SELECT ticket_id
      FROM ticket_events
      WHERE verb = 'assignee_changed'
      GROUP BY ticket_id
      HAVING COUNT(*) >= 2
    )
    SELECT
      r.ticket_id,
      (SELECT AVG(CAST(resp.rating AS REAL) * 5.0 / resp.scale)
        FROM responses resp
        WHERE resp.ticket_id = r.ticket_id) AS avg_csat
    FROM reassigned r
  `);
  const ticketCount = ticketRows.length;

  const csats = ticketRows
    .map((r) => r.avg_csat)
    .filter((v): v is number => v != null)
    .map(Number);
  const signalCsat =
    csats.length > 0 ? csats.reduce((a, b) => a + b, 0) / csats.length : null;
  const csatDelta =
    signalCsat != null && overallCsat != null ? signalCsat - overallCsat : null;

  // Top reassign-OUT actors come from previous_value.
  const actorRows = await db.all<{
    previous_value: string | null;
    name: string | null;
    n: number;
  }>(sql`
    WITH reassigned AS (
      SELECT ticket_id
      FROM ticket_events
      WHERE verb = 'assignee_changed'
      GROUP BY ticket_id
      HAVING COUNT(*) >= 2
    )
    SELECT te.previous_value, tm.name, COUNT(*) AS n
    FROM ticket_events te
    JOIN reassigned r ON r.ticket_id = te.ticket_id
    LEFT JOIN team_members tm ON tm.id = te.previous_value
    WHERE te.verb = 'assignee_changed'
      AND te.previous_value IS NOT NULL
    GROUP BY te.previous_value
    ORDER BY n DESC
    LIMIT 3
  `);

  return {
    verb: "reassigned_multiple",
    label: VERB_LABEL.reassigned_multiple,
    ticketCount,
    ticketShare: totalTickets > 0 ? ticketCount / totalTickets : 0,
    csatDelta,
    topActors: actorRows.map((a) => ({
      id: a.previous_value,
      name: a.name ?? "Unknown",
      count: Number(a.n),
    })),
  };
}

export async function getCoachingEventSignals(): Promise<EventSignal[]> {
  const [totalTickets, overallCsat] = await Promise.all([
    getTotalTickets(),
    getOverallAvgCsat(),
  ]);
  const [escalated, slaBreached, aiHandoff, reassigned] = await Promise.all([
    signalForVerb("escalated", totalTickets, overallCsat),
    signalForVerb("sla_breached", totalTickets, overallCsat),
    signalForVerb("ai_handoff", totalTickets, overallCsat),
    signalForReassignedMultiple(totalTickets, overallCsat),
  ]);
  return [escalated, slaBreached, aiHandoff, reassigned];
}

// ---------------------------------------------------------------------------
// 5. Top insight (derived from heatmap)
// ---------------------------------------------------------------------------

export type TopInsight = {
  text: string;
};

/** Find the worst-performing agent × category cell (with enough samples) and
 *  template a single-sentence insight from it. Returns null when there's no
 *  data to lean on. */
export function deriveTopInsight(
  heatmap: CoachingHeatmap,
  overallAvgScore: number | null,
): TopInsight | null {
  const MIN_SAMPLES = 5;
  const candidates = heatmap.cells.filter((c) => c.sampleSize >= MIN_SAMPLES);
  if (candidates.length === 0 || overallAvgScore == null) return null;

  const worst = candidates.reduce((acc, c) =>
    c.avgScore < acc.avgScore ? c : acc,
  );
  if (worst.avgScore >= overallAvgScore - 2) return null;

  const agent = heatmap.agents.find((a) => a.id === worst.agentId);
  const category = heatmap.categories.find((c) => c.id === worst.categoryId);
  if (!agent || !category) return null;

  return {
    text: `This week, your highest-leverage opportunity is improving ${category.name} on ${agent.name}'s tickets — ${worst.sampleSize} evaluations averaged ${Math.round(
      worst.avgScore,
    )} (vs. ${Math.round(overallAvgScore)} workspace avg).`,
  };
}

// ---------------------------------------------------------------------------
// Bundled fetch
// ---------------------------------------------------------------------------

export type CoachingInsightsBundle = {
  tiles: CoachingInsightsTiles;
  correlation: CorrelationBucket[];
  heatmap: CoachingHeatmap;
  signals: EventSignal[];
  topInsight: TopInsight | null;
};

export async function getCoachingInsights(): Promise<CoachingInsightsBundle> {
  const [tiles, correlation, heatmap, signals] = await Promise.all([
    getCoachingInsightsTiles(),
    getCoachingCorrelationBuckets(),
    getCoachingHeatmap(),
    getCoachingEventSignals(),
  ]);
  // Use overall score from heatmap cells (weighted by sample size) as the
  // anchor for the insight comparison — it's the same number agents see.
  const totalWeight = heatmap.cells.reduce((s, c) => s + c.sampleSize, 0);
  const weightedAvg =
    totalWeight > 0
      ? heatmap.cells.reduce((s, c) => s + c.avgScore * c.sampleSize, 0) /
        totalWeight
      : null;
  const topInsight = deriveTopInsight(heatmap, weightedAvg);

  return { tiles, correlation, heatmap, signals, topInsight };
}
