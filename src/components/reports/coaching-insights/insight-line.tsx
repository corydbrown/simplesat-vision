import { Sparkles } from "lucide-react";
import type { TopInsight } from "@/db/queries/coaching-insights";

export function CoachingInsightLine({
  insight,
}: {
  insight: TopInsight | null;
}) {
  if (!insight) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-blue-light bg-blue-lighter/40 px-4 py-3">
      <Sparkles size={16} className="mt-1 shrink-0 text-blue-default" />
      <p className="text-base italic text-foreground/90">{insight.text}</p>
    </div>
  );
}
