import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { DetailSection } from "@/components/shared/detail-section";
import { formatRelative } from "@/lib/format";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { QaStatusPill } from "@/components/qa/qa-status-pill";
import { EvaluateTicketButton } from "@/components/qa/evaluate-ticket-button";
import type { QaEvaluationView } from "@/db/queries/tickets";

type Props = {
  ticketId: string;
  evaluation: QaEvaluationView | null;
  /** Why evaluation is blocked (no assigned agent / no messages), or null if
   *  the ticket is evaluable. Surfaced as a disabled-button tooltip. */
  evaluateBlockedReason?: string | null;
};

export function TicketQaSection({
  ticketId,
  evaluation,
  evaluateBlockedReason,
}: Props) {
  return (
    <DetailSection
      title="QA evaluation"
      trailing={
        evaluation == null ? null : (
          <EvaluateTicketButton
            ticketId={ticketId}
            reEvaluate
            disabledReason={evaluateBlockedReason ?? undefined}
          />
        )
      }
    >
      {evaluation == null ? (
        <NotScoredState
          ticketId={ticketId}
          blockedReason={evaluateBlockedReason ?? undefined}
        />
      ) : (
        <ScoredCard evaluation={evaluation} />
      )}
    </DetailSection>
  );
}

function NotScoredState({
  ticketId,
  blockedReason,
}: {
  ticketId: string;
  blockedReason?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-2">
        <div className="text-base text-muted-foreground">
          This conversation hasn&rsquo;t been evaluated yet. Run the scorecard
          to see a breakdown and coaching notes.
        </div>
        <EvaluateTicketButton ticketId={ticketId} disabledReason={blockedReason} />
      </CardContent>
    </Card>
  );
}

function ScoredCard({ evaluation }: { evaluation: QaEvaluationView }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
        <QaScoreBadge
          score={evaluation.overallScore}
          status={evaluation.status}
          size="md"
        />
        <QaStatusPill status={evaluation.status} />
        <span className="text-base text-muted-foreground">
          Scored{" "}
          <TimestampTooltip date={evaluation.scoredAt}>
            <span>{formatRelative(evaluation.scoredAt)}</span>
          </TimestampTooltip>{" "}
          by {evaluation.scorer.displayName}
        </span>
        <Link
          href={`/coaching/${evaluation.id}`}
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open in Coaching
          <ArrowRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
