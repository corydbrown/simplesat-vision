import { StatCard, type StatCardDelta } from "@/components/shared/stat-card";
import type { CoachingInsightsTiles } from "@/db/queries/coaching-insights";

const HINT = "vs. prior 30 days";

export function CoachingTilesRow({ tiles }: { tiles: CoachingInsightsTiles }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Avg QA score"
        value={formatScore(tiles.avgScore.current)}
        delta={scoreDelta(tiles.avgScore.delta)}
      />
      <StatCard
        label="% evaluated"
        value={formatPercent(tiles.percentEvaluated.pct)}
        hint={`${tiles.percentEvaluated.evaluatedTickets.toLocaleString()} of ${tiles.percentEvaluated.eligibleTickets.toLocaleString()} solved/closed tickets`}
      />
      <StatCard
        label="Avg CSAT"
        value={formatCsat(tiles.avgCsat.current)}
        delta={csatDelta(tiles.avgCsat.delta)}
      />
      <StatCard
        label="AI accuracy"
        value={
          tiles.aiAccuracy.pct == null ? "—" : formatPercent(tiles.aiAccuracy.pct)
        }
        hint={
          tiles.aiAccuracy.sampleSize === 0
            ? "Needs human reviews"
            : `${tiles.aiAccuracy.sampleSize.toLocaleString()} overrides reviewed`
        }
      />
    </div>
  );
}

function formatScore(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatCsat(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)} / 5`;
}

function scoreDelta(delta: number | null): StatCardDelta | undefined {
  if (delta == null) return undefined;
  const sign = delta >= 0 ? "+" : "";
  return {
    label: `${sign}${delta.toFixed(1)}`,
    direction: deltaDirection(delta, 0.5),
    hint: HINT,
  };
}

function csatDelta(delta: number | null): StatCardDelta | undefined {
  if (delta == null) return undefined;
  const sign = delta >= 0 ? "+" : "";
  return {
    label: `${sign}${delta.toFixed(2)} stars`,
    direction: deltaDirection(delta, 0.05),
    hint: HINT,
  };
}

function deltaDirection(
  delta: number,
  neutralThreshold: number,
): StatCardDelta["direction"] {
  if (Math.abs(delta) < neutralThreshold) return "neutral";
  return delta > 0 ? "good" : "bad";
}
