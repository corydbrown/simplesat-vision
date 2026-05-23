"use client";

import { useMemo, useReducer, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  sampleTicket,
  type SampleCategory,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import { cn } from "@/lib/utils";

type Override = { score: number; reason: string };
type State = {
  step: number; // 0..N-1 = category index; N = summary
  overrides: Record<string, Override>;
  finalized: boolean;
};
type Action =
  | { type: "accept" }
  | { type: "override"; categoryId: string; override: Override }
  | { type: "jump"; step: number }
  | { type: "back" }
  | { type: "finalize" }
  | { type: "reopen" };

const categories = sampleTicket.evaluation.categories;
const totalSteps = categories.length;

const initialState: State = {
  step: 0,
  overrides: {},
  finalized: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "accept":
      return { ...state, step: Math.min(state.step + 1, totalSteps) };
    case "override":
      return {
        ...state,
        overrides: { ...state.overrides, [action.categoryId]: action.override },
        step: Math.min(state.step + 1, totalSteps),
      };
    case "jump":
      return { ...state, step: Math.max(0, Math.min(action.step, totalSteps)) };
    case "back":
      return { ...state, step: Math.max(0, state.step - 1) };
    case "finalize":
      return { ...state, finalized: true };
    case "reopen":
      return { ...state, finalized: false };
  }
}

export default function GuidedQaReviewPage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <div className="-mx-6 -my-4 min-h-screen bg-grey-lighter/40">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <TicketContext />
        <ProgressStrip
          step={state.step}
          overrides={state.overrides}
          onJump={(i) => dispatch({ type: "jump", step: i })}
        />
        {state.step < totalSteps ? (
          <CategoryStep
            key={categories[state.step].id}
            category={categories[state.step]}
            currentStep={state.step}
            existingOverride={state.overrides[categories[state.step].id]}
            onAccept={() => dispatch({ type: "accept" })}
            onOverride={(override) =>
              dispatch({
                type: "override",
                categoryId: categories[state.step].id,
                override,
              })
            }
            onBack={state.step > 0 ? () => dispatch({ type: "back" }) : null}
          />
        ) : (
          <SummaryView
            overrides={state.overrides}
            finalized={state.finalized}
            onFinalize={() => dispatch({ type: "finalize" })}
            onReopen={() => dispatch({ type: "reopen" })}
            onJump={(i) => dispatch({ type: "jump", step: i })}
            onBack={() => dispatch({ type: "back" })}
          />
        )}
      </div>
    </div>
  );
}

// ─── ticket context ─────────────────────────────────────────────────────────

function TicketContext() {
  const t = sampleTicket;
  return (
    <div className="mb-6 rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded bg-grey-lighter px-1.5 py-0.5 font-mono text-sm text-grey-darker">
          {t.externalId}
        </span>
        <span>·</span>
        <span className="capitalize">{t.channel}</span>
        <span>·</span>
        <span className="inline-flex items-center rounded bg-yellow-lighter px-1.5 py-0.5 text-sm font-medium capitalize text-yellow-darker">
          {t.customer.tier}
        </span>
      </div>
      <h1 className="text-base font-semibold leading-snug text-foreground">
        {t.subject}
      </h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          From <span className="text-foreground">{t.customer.name}</span>
        </span>
        <span>·</span>
        <span>
          Handled by{" "}
          <span className="text-foreground">{t.assignee.name}</span>
        </span>
      </div>
    </div>
  );
}

// ─── progress strip ─────────────────────────────────────────────────────────

function ProgressStrip({
  step,
  overrides,
  onJump,
}: {
  step: number;
  overrides: Record<string, Override>;
  onJump: (i: number) => void;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {step < totalSteps
            ? `Step ${step + 1} of ${totalSteps}`
            : "Review summary"}
        </p>
        <p className="text-sm text-muted-foreground">
          {Object.keys(overrides).length > 0
            ? `${Object.keys(overrides).length} override${Object.keys(overrides).length === 1 ? "" : "s"}`
            : "No overrides yet"}
        </p>
      </div>
      <div className="flex items-stretch gap-2">
        {categories.map((cat, i) => {
          const isCurrent = i === step;
          const isDone = i < step;
          const wasOverridden = !!overrides[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                "group flex-1 cursor-pointer rounded-md border px-2 py-2 text-left transition-all",
                isCurrent &&
                  "border-primary bg-primary/5 ring-2 ring-primary/20",
                isDone &&
                  !isCurrent &&
                  "border-border bg-card hover:border-primary/40",
                !isCurrent &&
                  !isDone &&
                  "border-dashed border-border bg-transparent text-muted-foreground hover:border-border-strong",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full text-xs font-semibold",
                    isCurrent && "bg-primary text-primary-foreground",
                    isDone && "bg-green-lighter text-green-darker",
                    !isCurrent && !isDone && "bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="size-3" /> : i + 1}
                </span>
                {wasOverridden && (
                  <span className="inline-flex items-center rounded bg-purple-lighter px-1 text-xs font-medium text-purple-darker">
                    edit
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "line-clamp-2 text-sm font-medium leading-tight",
                  isCurrent ? "text-foreground" : "",
                )}
              >
                {cat.name}
              </p>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onJump(totalSteps)}
          className={cn(
            "group flex-1 cursor-pointer rounded-md border px-2 py-2 text-left transition-all",
            step === totalSteps
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-dashed border-border bg-transparent text-muted-foreground hover:border-border-strong",
          )}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full",
                step === totalSteps
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Trophy className="size-3" />
            </span>
          </div>
          <p
            className={cn(
              "text-sm font-medium leading-tight",
              step === totalSteps && "text-foreground",
            )}
          >
            Summary
          </p>
        </button>
      </div>
    </div>
  );
}

// ─── category step ──────────────────────────────────────────────────────────

function CategoryStep({
  category,
  currentStep,
  existingOverride,
  onAccept,
  onOverride,
  onBack,
}: {
  category: SampleCategory;
  currentStep: number;
  existingOverride: Override | undefined;
  onAccept: () => void;
  onOverride: (override: Override) => void;
  onBack: (() => void) | null;
}) {
  const [mode, setMode] = useState<"choose" | "override">(
    existingOverride ? "override" : "choose",
  );
  const [draftScore, setDraftScore] = useState<number>(
    existingOverride?.score ?? category.aiScore,
  );
  const [draftReason, setDraftReason] = useState<string>(
    existingOverride?.reason ?? "",
  );
  const [showMessages, setShowMessages] = useState(false);

  const supportingMessages = useMemo<SampleMessage[]>(() => {
    const ids = new Set(category.highlightedMessageIds);
    return sampleTicket.messages.filter((m) => ids.has(m.id));
  }, [category.highlightedMessageIds]);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      {/* header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            Category {currentStep + 1} · {category.weightPercent}% weight
            {category.isAutofail && (
              <span className="ml-2 inline-flex items-center rounded bg-red-lighter px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-darker">
                auto-fail
              </span>
            )}
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-foreground">
            {category.name}
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            {category.description}
          </p>
        </div>
      </div>

      {/* AI's call */}
      <div className="mb-5 rounded-md border border-border bg-grey-lighter/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-purple-dark" />
          <span className="text-sm font-medium text-foreground">
            AI&rsquo;s call
          </span>
          <span className="text-sm text-muted-foreground">
            · {sampleTicket.evaluation.aiConfidence}% confidence
          </span>
        </div>
        <div className="flex items-start gap-5">
          <ScoreBadge
            score={category.aiScore}
            scale={category.scaleType}
            size="lg"
          />
          <p className="flex-1 text-base text-foreground">
            {category.aiReasoning}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowMessages((s) => !s)}
          className="mt-3 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {showMessages ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          {showMessages
            ? `Hide supporting messages`
            : `See supporting messages (${supportingMessages.length})`}
        </button>
        {showMessages && (
          <div className="mt-3 space-y-2">
            {supportingMessages.map((m) => (
              <div
                key={m.id}
                className="rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize",
                      m.role === "agent"
                        ? "bg-blue-lighter text-blue-darker"
                        : "bg-grey-lighter text-grey-darker",
                    )}
                  >
                    {m.role}
                  </span>
                  <span className="text-foreground">{m.authorName}</span>
                </div>
                <p className="text-base text-foreground">{m.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* actions */}
      {mode === "choose" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            className="h-12 flex-1 text-base"
            onClick={onAccept}
            autoFocus
          >
            <Check className="size-4" />
            Accept AI score ({formatScore(category.aiScore, category.scaleType)})
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 flex-1 text-base"
            onClick={() => setMode("override")}
          >
            <Pencil className="size-4" />
            Override
          </Button>
        </div>
      ) : (
        <OverridePanel
          category={category}
          draftScore={draftScore}
          draftReason={draftReason}
          onChangeScore={setDraftScore}
          onChangeReason={setDraftReason}
          onCancel={() => {
            setMode("choose");
            setDraftScore(existingOverride?.score ?? category.aiScore);
            setDraftReason(existingOverride?.reason ?? "");
          }}
          onConfirm={() => {
            onOverride({ score: draftScore, reason: draftReason.trim() });
          }}
        />
      )}

      {/* back link */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to previous category
        </button>
      )}
    </div>
  );
}

// ─── override panel ─────────────────────────────────────────────────────────

function OverridePanel({
  category,
  draftScore,
  draftReason,
  onChangeScore,
  onChangeReason,
  onCancel,
  onConfirm,
}: {
  category: SampleCategory;
  draftScore: number;
  draftReason: string;
  onChangeScore: (n: number) => void;
  onChangeReason: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isBinary = category.scaleType === "binary";
  const options = isBinary ? [0, 1] : [1, 2, 3, 4, 5];
  const canConfirm = draftReason.trim().length > 0;

  return (
    <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4">
      <p className="mb-3 text-sm font-medium text-foreground">
        Your score
      </p>
      <div
        className={cn(
          "mb-4 grid gap-2",
          isBinary ? "grid-cols-2" : "grid-cols-5",
        )}
      >
        {options.map((n) => {
          const isSelected = n === draftScore;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChangeScore(n)}
              className={cn(
                "h-14 cursor-pointer rounded-md border-2 text-base font-semibold transition-all",
                isSelected
                  ? scoreSelectedClasses(n, category.scaleType)
                  : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {isBinary ? (n === 1 ? "Pass" : "Fail") : n}
            </button>
          );
        })}
      </div>
      <p className="mb-2 text-sm font-medium text-foreground">
        Why are you overriding?
        <span className="ml-1 text-muted-foreground">
          (visible to the agent as coaching)
        </span>
      </p>
      <Textarea
        value={draftReason}
        onChange={(e) => onChangeReason(e.target.value)}
        placeholder="e.g. The acknowledgement came after the diagnosis — Priya was visibly anxious."
        rows={3}
        className="mb-3 text-base"
        autoFocus
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          className="h-11 flex-1 text-base"
          onClick={onConfirm}
          disabled={!canConfirm}
        >
          <ArrowRight className="size-4" />
          Save override &amp; continue
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="h-11 text-base"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── summary ────────────────────────────────────────────────────────────────

function SummaryView({
  overrides,
  finalized,
  onFinalize,
  onReopen,
  onJump,
  onBack,
}: {
  overrides: Record<string, Override>;
  finalized: boolean;
  onFinalize: () => void;
  onReopen: () => void;
  onJump: (i: number) => void;
  onBack: () => void;
}) {
  const finalScore = useMemo(() => {
    let total = 0;
    let maxTotal = 0;
    for (const cat of categories) {
      const override = overrides[cat.id];
      const score = override?.score ?? cat.aiScore;
      const max = cat.scaleType === "binary" ? 1 : 5;
      total += (score / max) * cat.weightPercent;
      maxTotal += cat.weightPercent;
    }
    return Math.round((total / maxTotal) * 100);
  }, [overrides]);

  const originalScore = sampleTicket.evaluation.overallScore;
  const delta = finalScore - originalScore;
  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-5">
        <div>
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            Review complete
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Final score
          </h2>
        </div>
        <div className="text-right">
          <div className={cn("text-5xl font-bold", overallScoreColor(finalScore))}>
            {finalScore}
            <span className="text-2xl font-medium text-muted-foreground">
              /100
            </span>
          </div>
          {delta !== 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              AI had {originalScore} ·{" "}
              <span
                className={cn(
                  "font-medium",
                  delta > 0 ? "text-green-dark" : "text-red-dark",
                )}
              >
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-base font-semibold text-foreground">
          Category breakdown
        </h3>
        <div className="space-y-2">
          {categories.map((cat) => {
            const override = overrides[cat.id];
            const effective = override?.score ?? cat.aiScore;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onJump(categories.indexOf(cat))}
                className="flex w-full cursor-pointer items-center gap-4 rounded-md border border-border px-3 py-3 text-left hover:border-primary/40 hover:bg-accent/30"
              >
                <ScoreBadge
                  score={effective}
                  scale={cat.scaleType}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-foreground">
                    {cat.name}
                  </p>
                  {override ? (
                    <p className="mt-0.5 line-clamp-1 text-sm text-purple-darker">
                      <Pencil className="mr-1 inline size-3" />
                      Edited from {formatScore(cat.aiScore, cat.scaleType)}:{" "}
                      <span className="italic">
                        &ldquo;{override.reason}&rdquo;
                      </span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Accepted AI score
                    </p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {cat.weightPercent}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CoachingBlock
          title="Strengths"
          variant="green"
          points={sampleTicket.evaluation.coaching.strengthPoints}
        />
        <CoachingBlock
          title="Growth opportunities"
          variant="yellow"
          points={sampleTicket.evaluation.coaching.growthPoints}
        />
      </div>

      {finalized ? (
        <div className="flex items-center justify-between rounded-md border-2 border-green-dark/40 bg-green-lighter px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-green-dark text-primary-foreground">
              <Check className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-green-darker">
                Review finalized
              </p>
              <p className="text-sm text-green-darker/80">
                {overrideCount === 0
                  ? "AI scoring accepted in full."
                  : `${overrideCount} override${overrideCount === 1 ? "" : "s"} saved as coaching for the agent.`}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onReopen}>
            Reopen
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            className="h-12 flex-1 text-base"
            onClick={onFinalize}
            autoFocus
          >
            <Check className="size-4" />
            Finalize review
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="h-12 text-base"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
            Back to last category
          </Button>
        </div>
      )}
    </div>
  );
}

function CoachingBlock({
  title,
  variant,
  points,
}: {
  title: string;
  variant: "green" | "yellow";
  points: string[];
}) {
  const tone =
    variant === "green"
      ? "border-green-dark/30 bg-green-lighter/50"
      : "border-yellow-dark/30 bg-yellow-lighter/50";
  const dot = variant === "green" ? "bg-green-dark" : "bg-yellow-dark";
  return (
    <div className={cn("rounded-md border p-4", tone)}>
      <p className="mb-2 text-base font-semibold text-foreground">{title}</p>
      <ul className="space-y-2">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2 text-base text-foreground">
            <span
              className={cn("mt-1.5 inline-block size-1.5 shrink-0 rounded-full", dot)}
            />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── score helpers ──────────────────────────────────────────────────────────

function ScoreBadge({
  score,
  scale,
  size,
}: {
  score: number;
  scale: SampleCategory["scaleType"];
  size: "sm" | "lg";
}) {
  const max = scale === "binary" ? 1 : 5;
  const label =
    scale === "binary" ? (score === 1 ? "Pass" : "Fail") : `${score}/${max}`;
  const dim = size === "lg" ? "size-16 text-2xl" : "size-12 text-base";
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border-2 font-bold",
        dim,
        scoreFillClasses(score, scale),
      )}
    >
      {label}
    </div>
  );
}

function scoreFillClasses(
  score: number,
  scale: SampleCategory["scaleType"],
): string {
  if (scale === "binary") {
    return score === 1
      ? "bg-green-lighter text-green-darker border-green-dark/40"
      : "bg-red-lighter text-red-darker border-red-dark/40";
  }
  if (score >= 5) return "bg-green-lighter text-green-darker border-green-dark/40";
  if (score === 4) return "bg-green-lighter text-green-darker border-green-dark/30";
  if (score === 3) return "bg-yellow-lighter text-yellow-darker border-yellow-dark/40";
  if (score === 2) return "bg-red-lighter text-red-darker border-red-dark/30";
  return "bg-red-lighter text-red-darker border-red-dark/40";
}

function scoreSelectedClasses(
  score: number,
  scale: SampleCategory["scaleType"],
): string {
  if (scale === "binary") {
    return score === 1
      ? "border-green-dark bg-green-lighter text-green-darker"
      : "border-red-dark bg-red-lighter text-red-darker";
  }
  if (score >= 4) return "border-green-dark bg-green-lighter text-green-darker";
  if (score === 3) return "border-yellow-dark bg-yellow-lighter text-yellow-darker";
  return "border-red-dark bg-red-lighter text-red-darker";
}

function formatScore(
  score: number,
  scale: SampleCategory["scaleType"],
): string {
  if (scale === "binary") return score === 1 ? "Pass" : "Fail";
  return `${score}/5`;
}

function overallScoreColor(score: number): string {
  if (score >= 90) return "text-green-darker";
  if (score >= 75) return "text-green-dark";
  if (score >= 60) return "text-yellow-darker";
  return "text-red-darker";
}
