import { DashboardCard } from "@/components/shared/dashboard-card";
import { Heatmap, type HeatmapCell } from "@/components/shared/heatmap";
import type { CoachingHeatmap } from "@/db/queries/coaching-insights";

/** Map an avg category score (0-100) to a production hue token class set.
 *  Same ladder as QaScoreBadge, but applied as a cell background. */
function toneForScore(score: number): string {
  if (score < 60) return "bg-red-light text-red-darker";
  if (score < 70) return "bg-yellow-light text-yellow-darker";
  if (score < 85) return "bg-green-light text-green-darker";
  return "bg-green-default text-white";
}

type CellData = { sampleSize: number };

export function CoachingHeatmapSection({
  heatmap,
}: {
  heatmap: CoachingHeatmap;
}) {
  if (heatmap.agents.length === 0 || heatmap.categories.length === 0) {
    return (
      <DashboardCard title="Team performance">
        <p className="text-base text-muted-foreground">
          No evaluations yet — heatmap will populate once tickets are scored.
        </p>
      </DashboardCard>
    );
  }

  const rows = heatmap.agents.map((a) => ({
    id: a.id,
    label: a.name,
    sublabel: `${a.team} • ${a.evaluationCount} evals`,
  }));
  const cols = heatmap.categories.map((c) => ({
    id: c.id,
    label: c.name,
  }));
  const cells: HeatmapCell<CellData>[] = heatmap.cells.map((c) => ({
    row: c.agentId,
    col: c.categoryId,
    value: c.avgScore,
    data: { sampleSize: c.sampleSize },
  }));

  return (
    <DashboardCard title="Team performance">
      <p className="mb-3 text-base text-muted-foreground">
        Average category scores by agent. Cells are colored against the
        rubric; gray cells mean no evaluations in that category yet.
      </p>
      <Heatmap<CellData>
        ariaLabel="Agent × category average scores"
        rows={rows}
        cols={cols}
        cells={cells}
        toneFor={(value) => toneForScore(value)}
        formatValue={(value) => Math.round(value)}
        tooltipFor={(agentId, categoryId, value, data) => {
          const agent = heatmap.agents.find((a) => a.id === agentId);
          const category = heatmap.categories.find((c) => c.id === categoryId);
          return `${agent?.name ?? ""} • ${category?.name ?? ""} — avg ${Math.round(
            value,
          )} (${data?.sampleSize ?? 0} evals)`;
        }}
        emptyTooltip={() => "No evaluations in this category yet"}
        hrefFor={(agentId, categoryId) =>
          `/team-members/${agentId}?category=${categoryId}`
        }
      />
    </DashboardCard>
  );
}
