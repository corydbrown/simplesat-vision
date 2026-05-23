"use client";

import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { DetailSection } from "@/components/shared/detail-section";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  QA_BUCKET_CLASSES,
  QA_BUCKET_LABEL,
  qaScoreBucket,
  type QaScoreBucket,
} from "@/lib/qa/score-color";
import { QaStatusPill } from "@/components/qa/qa-status-pill";
import { editCategoryScore } from "@/lib/qa/actions";
import type {
  QaCategoryView,
  QaCoachingView,
  QaEditorView,
  QaEvaluationView,
} from "@/db/queries/tickets";

type Props = {
  evaluation: QaEvaluationView | null;
  /** Click handler for any supporting-message chip / coaching example link.
   *  Caller scrolls + ring-highlights the target message in the activity
   *  feed above. */
  onHighlightMessage: (messageId: string) => void;
};

/** Round-one role gate. SVP-58 hardcodes manager access on; real auth lands
 *  with the multi-user epic. Defining the boolean here documents the seam so
 *  the day-one swap is mechanical. */
const CURRENT_USER_IS_MANAGER = true;

const REASON_MIN_LENGTH = 8;

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
          title="Bulk scoring lands later — inline edits work on already-scored tickets"
        >
          Score now
        </Button>
      </CardContent>
    </Card>
  );
}

function ScoredState({
  evaluation: serverEvaluation,
  onHighlightMessage,
}: {
  evaluation: QaEvaluationView;
  onHighlightMessage: (messageId: string) => void;
}) {
  // Keep an optimistic local copy so the card flips to "edited" state without
  // waiting for the page to revalidate. Server action also revalidates the
  // ticket route, so a refresh shows the same state.
  const [view, setView] = useState<QaEvaluationView>(serverEvaluation);
  const invalidated = view.status === "invalidated";

  const handleCategorySaved = (
    categoryId: string,
    update: {
      humanScore: number;
      humanScoreReason: string;
      effectiveScore: number;
      overallScore: number;
      editedAt: number;
      editor: QaEditorView;
    },
  ) => {
    setView((prev) => ({
      ...prev,
      status: "edited",
      overallScore: update.overallScore,
      editedAt: new Date(update.editedAt),
      editor: update.editor,
      categories: prev.categories.map((c) =>
        c.categoryId === categoryId
          ? {
              ...c,
              humanScore: update.humanScore,
              humanScoreReason: update.humanScoreReason,
              effectiveScore: update.effectiveScore,
            }
          : c,
      ),
    }));
  };

  return (
    <div
      className={`space-y-4 ${invalidated ? "opacity-60" : ""}`}
      aria-disabled={invalidated || undefined}
    >
      <Header evaluation={view} invalidated={invalidated} />

      {invalidated && view.invalidatedReason && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-light bg-yellow-lighter px-4 py-3 text-base text-yellow-darker">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">Evaluation invalidated</div>
            <div>{view.invalidatedReason}</div>
          </div>
        </div>
      )}

      <div className={`space-y-3 ${invalidated ? "line-through" : ""}`}>
        {view.categories.map((category) => (
          <CategoryCard
            key={category.categoryId}
            evaluationId={view.id}
            evaluationEditor={view.editor}
            evaluationEditedAt={view.editedAt}
            category={category}
            canEdit={CURRENT_USER_IS_MANAGER && !invalidated}
            onHighlightMessage={onHighlightMessage}
            onSaved={handleCategorySaved}
          />
        ))}
      </div>

      {view.coaching && (
        <CoachingSummary
          coaching={view.coaching}
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
  evaluationId,
  evaluationEditor,
  evaluationEditedAt,
  category,
  canEdit,
  onHighlightMessage,
  onSaved,
}: {
  evaluationId: string;
  evaluationEditor: QaEditorView | null;
  evaluationEditedAt: Date | null;
  category: QaCategoryView;
  canEdit: boolean;
  onHighlightMessage: (messageId: string) => void;
  onSaved: (
    categoryId: string,
    update: {
      humanScore: number;
      humanScoreReason: string;
      effectiveScore: number;
      overallScore: number;
      editedAt: number;
      editor: QaEditorView;
    },
  ) => void;
}) {
  const [isEditing, setEditing] = useState(false);
  const isEdited = category.humanScore != null;

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
            {isEdited && <EditedBadge />}
          </div>
          <div className="flex items-center gap-3">
            {!isEditing && <ScoreVisualization category={category} />}
            {canEdit && !isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="h-7 cursor-pointer gap-1 px-2 text-sm"
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {isEditing ? (
          <ScoreEditor
            evaluationId={evaluationId}
            category={category}
            onCancel={() => setEditing(false)}
            onSaved={(update) => {
              onSaved(category.categoryId, update);
              setEditing(false);
            }}
          />
        ) : (
          <>
            {category.aiReasoning && (
              <p className="text-base text-foreground">
                {category.aiReasoning}
              </p>
            )}

            {category.highlightedMessageIds.length > 0 && (
              <SupportingMessagesRow
                messageIds={category.highlightedMessageIds}
                onHighlightMessage={onHighlightMessage}
              />
            )}

            {isEdited && (
              <EditHistory
                category={category}
                editor={evaluationEditor}
                editedAt={evaluationEditedAt}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EditedBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-blue-lighter px-2 py-0.5 text-sm font-medium text-blue-darker">
      Edited
    </span>
  );
}

function ScoreVisualization({ category }: { category: QaCategoryView }) {
  const isEdited = category.humanScore != null;
  if (category.scaleType === "binary") {
    return (
      <div className="flex items-baseline gap-2">
        {isEdited && (
          <span className="text-base tabular-nums text-muted-foreground">
            AI: <AiInlineBinary passed={category.aiScore === 1} /> →
            <span className="ml-1">You:</span>
          </span>
        )}
        <BinaryResult passed={category.effectiveScore === 1} />
      </div>
    );
  }
  if (category.scaleType === "three_state") {
    return (
      <div className="flex items-baseline gap-2 text-base font-medium tabular-nums">
        {isEdited && (
          <span className="font-normal text-muted-foreground">
            AI: {category.aiScore} / 2 → You:
          </span>
        )}
        <span className="text-foreground">
          {category.effectiveScore} / 2
        </span>
      </div>
    );
  }
  // likert_5
  if (isEdited) {
    return (
      <div className="flex items-baseline gap-2 text-base tabular-nums">
        <span className="text-muted-foreground">
          AI: {category.aiScore} / 5 →
        </span>
        <LikertLadder score={category.effectiveScore} />
      </div>
    );
  }
  return <LikertLadder score={category.effectiveScore} />;
}

function AiInlineBinary({ passed }: { passed: boolean }) {
  return (
    <span
      className={`ml-1 inline-flex items-center gap-0.5 ${
        passed ? "text-green-dark" : "text-red-dark"
      }`}
    >
      {passed ? "Pass" : "Fail"}
    </span>
  );
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
// Score editor (inline)
// ---------------------------------------------------------------------------

function ScoreEditor({
  evaluationId,
  category,
  onCancel,
  onSaved,
}: {
  evaluationId: string;
  category: QaCategoryView;
  onCancel: () => void;
  onSaved: (update: {
    humanScore: number;
    humanScoreReason: string;
    effectiveScore: number;
    overallScore: number;
    editedAt: number;
    editor: QaEditorView;
  }) => void;
}) {
  const [score, setScore] = useState<number>(category.effectiveScore);
  const [reason, setReason] = useState<string>(
    category.humanScoreReason ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN_LENGTH) {
      setError(
        `Add a short explanation (${REASON_MIN_LENGTH}+ characters) so the change is auditable.`,
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await editCategoryScore({
          evaluationId,
          categoryId: category.categoryId,
          humanScore: score,
          reason: trimmed,
        });
        onSaved({
          humanScore: result.category.humanScore,
          humanScoreReason: result.category.humanScoreReason,
          effectiveScore: result.category.effectiveScore,
          overallScore: result.evaluation.overallScore,
          editedAt: result.evaluation.editedAt,
          editor: result.evaluation.editor,
        });
      } catch (err) {
        console.error(err);
        setError("Couldn't save the edit. Try again or refresh.");
      }
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-accent/30 p-3">
      <div>
        <div className="mb-1.5 text-sm font-medium text-foreground">
          {category.scaleType === "binary" ? "Pass / Fail" : "Score"}
        </div>
        {category.scaleType === "binary" ? (
          <BinaryToggle value={score} onChange={setScore} />
        ) : (
          <LikertToggle value={score} onChange={setScore} />
        )}
      </div>

      <div>
        <label
          htmlFor={`reason-${category.categoryId}`}
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Why are you changing this?{" "}
          <span className="font-normal text-muted-foreground">
            (required, auditable)
          </span>
        </label>
        <Textarea
          id={`reason-${category.categoryId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="The AI missed that the customer acknowledged the resolution mid-thread…"
          className="text-base"
        />
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-base text-red-dark">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="cursor-pointer"
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function LikertToggle({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      onValueChange={(v) => {
        if (v) onChange(Number(v));
      }}
      variant="outline"
      spacing={0}
      className="w-fit"
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <ToggleGroupItem
          key={step}
          value={String(step)}
          aria-label={`${step} out of 5`}
          className="min-w-9 cursor-pointer tabular-nums"
        >
          {step}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function BinaryToggle({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      onValueChange={(v) => {
        if (v) onChange(Number(v));
      }}
      variant="outline"
      spacing={0}
      className="w-fit"
    >
      <ToggleGroupItem
        value="1"
        aria-label="Pass"
        className="cursor-pointer gap-1"
      >
        <Check className="size-3.5" />
        Pass
      </ToggleGroupItem>
      <ToggleGroupItem
        value="0"
        aria-label="Fail"
        className="cursor-pointer gap-1"
      >
        <X className="size-3.5" />
        Fail
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

// ---------------------------------------------------------------------------
// Edit history
// ---------------------------------------------------------------------------

function EditHistory({
  category,
  editor,
  editedAt,
}: {
  category: QaCategoryView;
  editor: QaEditorView | null;
  editedAt: Date | null;
}) {
  const [open, setOpen] = useState(false);
  if (category.humanScore == null) return null;

  return (
    <div className="rounded-md border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-base text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        Edit history
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3 pt-1 text-base">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-muted-foreground">AI score</span>
            <span className="text-foreground tabular-nums">
              {formatScore(category.scaleType, category.aiScore)}
            </span>
            <span className="text-muted-foreground">Human score</span>
            <span className="text-foreground tabular-nums">
              {formatScore(category.scaleType, category.humanScore)}
            </span>
            <span className="text-muted-foreground">Reason</span>
            <span className="text-foreground">
              {category.humanScoreReason ?? "—"}
            </span>
            <span className="text-muted-foreground">By</span>
            <span className="text-foreground">
              {editor ? editor.name : "Unknown"}
            </span>
            <span className="text-muted-foreground">When</span>
            <span
              className="text-foreground"
              title={editedAt ? formatDateTime(editedAt) : undefined}
            >
              {editedAt ? formatRelative(editedAt) : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatScore(scale: string, score: number | null): string {
  if (score == null) return "—";
  if (scale === "binary") return score === 1 ? "Pass" : "Fail";
  if (scale === "three_state") return `${score} / 2`;
  return `${score} / 5`;
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
