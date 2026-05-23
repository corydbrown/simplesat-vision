"use client";

import { AlertTriangle, Bot, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DetailSection } from "@/components/shared/detail-section";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  QA_BUCKET_CLASSES,
  QA_BUCKET_LABEL,
  qaScoreBucket,
  type QaScoreBucket,
} from "@/lib/qa/score-color";
import { QaStatusPill } from "@/components/qa/qa-status-pill";
import type {
  QaCategoryView,
  QaCoachingView,
  QaEvaluationView,
} from "@/db/queries/tickets";

type Props = {
  evaluation: QaEvaluationView | null;
  /** Click handler for any supporting-message chip / coaching example link.
   *  Caller scrolls + ring-highlights the target message in the activity
   *  feed above. */
  onHighlightMessage: (messageId: string) => void;
};

export function TicketQaSection({ evaluation, onHighlightMessage }: Props) {
  return (
    <DetailSection title="QA evaluation">
      {evaluation == null ? (
        <NotScoredState />
      ) : (
        <ScoredState
          evaluation={evaluation}
          onHighlightMessage={onHighlightMessage}
        />
      )}
    </DetailSection>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

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
          title="Inline scoring lands with SVP-58"
        >
          Score now
        </Button>
      </CardContent>
    </Card>
  );
}

function ScoredState({
  evaluation,
  onHighlightMessage,
}: {
  evaluation: QaEvaluationView;
  onHighlightMessage: (messageId: string) => void;
}) {
  const invalidated = evaluation.status === "invalidated";
  return (
    <div
      className={`space-y-4 ${invalidated ? "opacity-60" : ""}`}
      aria-disabled={invalidated || undefined}
    >
      <Header evaluation={evaluation} invalidated={invalidated} />

      {invalidated && evaluation.invalidatedReason && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-light bg-yellow-lighter px-4 py-3 text-base text-yellow-darker">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">Evaluation invalidated</div>
            <div>{evaluation.invalidatedReason}</div>
          </div>
        </div>
      )}

      <div className={`space-y-3 ${invalidated ? "line-through" : ""}`}>
        {evaluation.categories.map((category) => (
          <CategoryCard
            key={category.categoryId}
            category={category}
            onHighlightMessage={onHighlightMessage}
          />
        ))}
      </div>

      {evaluation.coaching && (
        <CoachingSummary
          coaching={evaluation.coaching}
          onHighlightMessage={onHighlightMessage}
          invalidated={invalidated}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({
  evaluation,
  invalidated,
}: {
  evaluation: QaEvaluationView;
  invalidated: boolean;
}) {
  const bucket = qaScoreBucket(evaluation.overallScore, evaluation.status);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <OverallScoreBadge score={evaluation.overallScore} bucket={bucket} />
      <div className="flex flex-wrap items-center gap-2">
        <ConfidencePill confidencePercent={evaluation.aiConfidence} />
        <QaStatusPill status={evaluation.status} />
      </div>
      <div className="ml-auto inline-flex items-center gap-1.5 text-base text-muted-foreground">
        <Bot className="size-4" />
        <span>
          Scored by {evaluation.scorer.displayName}
          <span className="text-muted-foreground/60"> · </span>
          <span
            className={invalidated ? "line-through" : ""}
            title={formatDateTime(evaluation.scoredAt)}
          >
            {formatRelative(evaluation.scoredAt)}
          </span>
        </span>
      </div>
    </div>
  );
}

function OverallScoreBadge({
  score,
  bucket,
}: {
  score: number;
  bucket: QaScoreBucket;
}) {
  const classes = QA_BUCKET_CLASSES[bucket];
  // Adds a subtle border on the standalone card surface — the tabular pill in
  // QaScoreBadge stays unbordered (extra weight reads as chrome in a dense
  // column; this lonely badge benefits from the outline).
  return (
    <div
      className={`inline-flex items-baseline gap-1.5 rounded-lg border px-3 py-2 ${classes.bg} ${classes.text} ${classes.border}`}
      title={QA_BUCKET_LABEL[bucket]}
    >
      <span className="text-3xl font-semibold leading-none tabular-nums">
        {score}
      </span>
      <span className="text-base font-medium opacity-70">
        {bucket === "auto-failed" ? "· auto-fail" : "/ 100"}
      </span>
    </div>
  );
}

function ConfidencePill({ confidencePercent }: { confidencePercent: number }) {
  return (
    <span className="inline-flex items-center rounded-md bg-grey-lighter px-2 py-0.5 text-sm text-grey-darker">
      <span className="font-medium">{confidencePercent}%</span>
      <span className="ml-1 opacity-80">confidence</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Category card
// ---------------------------------------------------------------------------

function CategoryCard({
  category,
  onHighlightMessage,
}: {
  category: QaCategoryView;
  onHighlightMessage: (messageId: string) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 py-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-medium">{category.name}</h3>
            {category.weightPercent > 0 && (
              <span className="text-base text-muted-foreground">
                {category.weightPercent}% weight
              </span>
            )}
            {category.isAutofail && (
              <span className="inline-flex items-center rounded-md bg-grey-lighter px-2 py-0.5 text-sm text-grey-darker">
                Auto-fail
              </span>
            )}
          </div>
          <ScoreVisualization category={category} />
        </div>

        {category.aiReasoning && (
          <p className="text-base text-foreground">{category.aiReasoning}</p>
        )}

        {category.highlightedMessageIds.length > 0 && (
          <SupportingMessagesRow
            messageIds={category.highlightedMessageIds}
            onHighlightMessage={onHighlightMessage}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ScoreVisualization({ category }: { category: QaCategoryView }) {
  if (category.scaleType === "binary") {
    return <BinaryResult passed={category.effectiveScore === 1} />;
  }
  if (category.scaleType === "three_state") {
    return (
      <span className="text-base font-medium tabular-nums text-foreground">
        {category.effectiveScore} / 2
      </span>
    );
  }
  return <LikertLadder score={category.effectiveScore} />;
}

function LikertLadder({ score }: { score: number }) {
  const safe = Math.max(0, Math.min(5, score));
  return (
    <div
      className="flex items-center gap-2"
      title={`${safe} out of 5`}
      aria-label={`${safe} out of 5`}
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((step) => {
          const filled = step <= safe;
          return (
            <span
              key={step}
              className={`inline-block size-2.5 rounded-full ${
                filled ? "bg-primary" : "bg-grey-light"
              }`}
            />
          );
        })}
      </div>
      <span className="text-base font-medium tabular-nums text-foreground">
        {safe}
        <span className="text-muted-foreground"> / 5</span>
      </span>
    </div>
  );
}

function BinaryResult({ passed }: { passed: boolean }) {
  if (passed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-green-lighter px-2 py-0.5 text-sm font-medium text-green-darker">
        <Check className="size-3.5" />
        Pass
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-red-lighter px-2 py-0.5 text-sm font-medium text-red-darker">
      <X className="size-3.5" />
      Fail
    </span>
  );
}

function SupportingMessagesRow({
  messageIds,
  onHighlightMessage,
}: {
  messageIds: string[];
  onHighlightMessage: (messageId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-base text-muted-foreground">Supporting:</span>
      {messageIds.map((id, idx) => (
        <button
          key={id}
          type="button"
          onClick={() => onHighlightMessage(id)}
          className="cursor-pointer rounded-md bg-accent/40 px-2 py-0.5 text-sm text-foreground transition-colors hover:bg-accent"
        >
          Message {idx + 1}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coaching summary
// ---------------------------------------------------------------------------

function CoachingSummary({
  coaching,
  onHighlightMessage,
  invalidated,
}: {
  coaching: QaCoachingView;
  onHighlightMessage: (messageId: string) => void;
  invalidated: boolean;
}) {
  const hasStrengths = coaching.strengthPoints.length > 0;
  const hasGrowth = coaching.growthPoints.length > 0;
  if (!hasStrengths && !hasGrowth) return null;

  return (
    <Card>
      <CardContent className="py-2">
        <div className="grid gap-6 sm:grid-cols-2">
          <CoachingColumn
            heading="What went well"
            icon={<Check className="size-4 text-green-dark" />}
            points={coaching.strengthPoints}
            exampleMessageIds={coaching.exampleMessageIds}
            onHighlightMessage={onHighlightMessage}
            invalidated={invalidated}
            emptyLabel="No specific strengths called out."
          />
          <CoachingColumn
            heading="Could improve"
            icon={<AlertTriangle className="size-4 text-yellow-dark" />}
            points={coaching.growthPoints}
            exampleMessageIds={coaching.exampleMessageIds}
            onHighlightMessage={onHighlightMessage}
            invalidated={invalidated}
            emptyLabel="No growth areas flagged."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CoachingColumn({
  heading,
  icon,
  points,
  exampleMessageIds,
  onHighlightMessage,
  invalidated,
  emptyLabel,
}: {
  heading: string;
  icon: React.ReactNode;
  points: string[];
  exampleMessageIds: string[];
  onHighlightMessage: (messageId: string) => void;
  invalidated: boolean;
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-base font-medium">
        {icon}
        {heading}
      </div>
      {points.length === 0 ? (
        <div className="text-base text-muted-foreground">{emptyLabel}</div>
      ) : (
        <ul className="space-y-1.5">
          {points.map((point, idx) => {
            // Pair each bullet with one example message id, cycling if there
            // are fewer examples than bullets. exampleMessageIds is shared
            // across strengths + growth — that's PRD-shape, not a bug.
            const exampleId =
              exampleMessageIds.length > 0
                ? exampleMessageIds[idx % exampleMessageIds.length]
                : null;
            return (
              <li
                key={idx}
                className="flex items-start gap-2 text-base text-foreground"
              >
                <span className="mt-2 inline-block size-1 shrink-0 rounded-full bg-muted-foreground" />
                <span className="min-w-0 flex-1">
                  {point}
                  {exampleId && !invalidated && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => onHighlightMessage(exampleId)}
                        className="cursor-pointer text-primary underline-offset-2 hover:underline"
                      >
                        See example
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
