import { AlertTriangle, Clock, Bot, Shuffle } from "lucide-react";
import { DashboardCard } from "@/components/shared/dashboard-card";
import type {
  EventSignal,
  EventSignalVerb,
} from "@/db/queries/coaching-insights";

const VERB_ICON: Record<EventSignalVerb, React.ComponentType<{ size?: number; className?: string }>> = {
  escalated: AlertTriangle,
  sla_breached: Clock,
  ai_handoff: Bot,
  reassigned_multiple: Shuffle,
};

const VERB_ICON_TONE: Record<EventSignalVerb, string> = {
  escalated: "text-red-default",
  sla_breached: "text-yellow-dark",
  ai_handoff: "text-blue-default",
  reassigned_multiple: "text-yellow-dark",
};

export function CoachingSignalsPanel({
  signals,
}: {
  signals: EventSignal[];
}) {
  return (
    <DashboardCard title="Ticket signals">
      <p className="mb-3 text-base text-muted-foreground">
        High-signal events on this period&apos;s tickets and their CSAT impact.
      </p>
      <div className="divide-y divide-border">
        {signals.map((s) => (
          <SignalRow key={s.verb} signal={s} />
        ))}
      </div>
    </DashboardCard>
  );
}

function SignalRow({ signal }: { signal: EventSignal }) {
  const Icon = VERB_ICON[signal.verb];
  const iconTone = VERB_ICON_TONE[signal.verb];
  const sharePct = (signal.ticketShare * 100).toFixed(1);
  const csatLine = formatCsatImpact(signal.csatDelta);
  const actors = signal.topActors.slice(0, 3);

  return (
    <div className="flex gap-3 py-3">
      <Icon size={18} className={`mt-0.5 shrink-0 ${iconTone}`} />
      <div className="min-w-0 flex-1">
        <div className="text-base text-foreground">
          <span className="font-medium">
            {signal.label}: {signal.ticketCount.toLocaleString()}
          </span>{" "}
          <span className="text-muted-foreground">
            ({sharePct}% of tickets)
          </span>
        </div>
        <div className="mt-0.5 text-base text-muted-foreground">
          {csatLine}
          {actors.length > 0 ? (
            <>
              {" "}
              <span className="text-muted-foreground">
                {signal.verb === "reassigned_multiple"
                  ? "Top reassign-out agents:"
                  : "Top actors:"}
              </span>{" "}
              {actors.map((a, i) => (
                <span key={a.id ?? i} className="text-foreground">
                  {a.name}{" "}
                  <span className="text-muted-foreground">
                    ({a.count}
                    {i < actors.length - 1 ? "), " : ")"}
                  </span>
                </span>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatCsatImpact(delta: number | null): React.ReactNode {
  if (delta == null) {
    return "CSAT impact: not enough responses yet.";
  }
  const sign = delta >= 0 ? "+" : "";
  const tone =
    delta < -0.1
      ? "text-red-dark"
      : delta > 0.1
        ? "text-green-dark"
        : "text-foreground";
  return (
    <>
      Avg CSAT impact:{" "}
      <span className={`${tone} tabular-nums`}>
        {sign}
        {delta.toFixed(2)} stars
      </span>
      .
    </>
  );
}
