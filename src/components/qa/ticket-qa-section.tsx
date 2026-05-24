import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DetailSection } from "@/components/shared/detail-section";
import { formatRelative } from "@/lib/format";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { QaStatusPill } from "@/components/qa/qa-status-pill";
import type { QaEvaluationView } from "@/db/queries/tickets";

type Props = {
  evaluation: QaEvaluationView | null;
};

export function TicketQaSection({ evaluation }: Props) {
  return (
    <DetailSection title="QA evaluation">
      {evaluation == null ? (
        <NotScoredState />
      ) : (
        <ScoredCard evaluation={evaluation} />
      )}
    </DetailSection>
  );
}

function NotScoredState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-2">
        <div className="text-base text-muted-foreground">
          This conversation hasn&rsquo;t been evaluated yet.
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="cursor-not-allowed"
          title="Scoring is triggered automatically — manual scoring lands in a later release"
        >
          Score this ticket
        </Button>
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
          Scored {formatRelative(evaluation.scoredAt)} by{" "}
          {evaluation.scorer.displayName}
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
