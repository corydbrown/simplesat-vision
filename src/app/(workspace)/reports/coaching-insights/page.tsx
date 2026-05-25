import { Topbar } from "@/components/shell/topbar";
import { CoachingInsightLine } from "@/components/reports/coaching-insights/insight-line";
import { CoachingTilesRow } from "@/components/reports/coaching-insights/tiles-row";
import { CoachingCorrelationPanel } from "@/components/reports/coaching-insights/correlation-panel";
import { CoachingHeatmapSection } from "@/components/reports/coaching-insights/heatmap-section";
import { CoachingSignalsPanel } from "@/components/reports/coaching-insights/signals-panel";
import { getCoachingInsights } from "@/db/queries/coaching-insights";

export const dynamic = "force-dynamic";

export default async function CoachingInsightsPage() {
  const { tiles, correlation, heatmap, signals, topInsight } =
    await getCoachingInsights();

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Reports", href: "/reports" },
          { label: "Coaching insights" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 px-gutter py-6">
        <CoachingInsightLine insight={topInsight} />
        <CoachingTilesRow tiles={tiles} />
        <CoachingCorrelationPanel buckets={correlation} />
        <CoachingHeatmapSection heatmap={heatmap} />
        <CoachingSignalsPanel signals={signals} />
      </div>
    </>
  );
}
