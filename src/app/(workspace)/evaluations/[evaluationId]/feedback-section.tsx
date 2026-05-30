"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/shared/mention-textarea";
import { ReasoningWithMentions } from "@/components/shared/inline-mention";
import { EmptyState as SharedEmptyState } from "@/components/shared/empty-state";
import type { MentionSource } from "@/lib/mentions/types";
import { formatRelative } from "@/lib/format";
import {
  deleteEvaluationFeedback,
  saveEvaluationFeedback,
  type FeedbackEntry,
} from "@/lib/qa/feedback/actions";

const MAX_CHARS = 10_000;

type Props = {
  evaluationId: string;
  myFeedback: FeedbackEntry | null;
  otherFeedback: FeedbackEntry[];
  /** `@` mention source — the evaluated ticket's messages. */
  mentionSources: MentionSource[];
  /** Maps "Message N" → message id so rendered refs are clickable. */
  messageIdByNumber: Map<number, string>;
  /** Scrolls + flashes the referenced message in the conversation above. */
  onJumpToMessage: (messageId: string) => void;
};

export function FeedbackSection({
  evaluationId,
  myFeedback,
  otherFeedback,
  mentionSources,
  messageIdByNumber,
  onJumpToMessage,
}: Props) {
  const [draft, setDraft] = useState(myFeedback?.feedbackText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasExisting = myFeedback !== null;
  const trimmed = draft.trim();
  const dirty = trimmed !== (myFeedback?.feedbackText ?? "");
  const canSave = trimmed.length > 0 && trimmed.length <= MAX_CHARS && dirty;

  function handleSave() {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveEvaluationFeedback({
          evaluationId,
          feedbackText: trimmed,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function handleDelete() {
    if (!myFeedback) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteEvaluationFeedback({ feedbackId: myFeedback.id });
        setDraft("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <section className="mt-12 border-t border-border pt-10">
      <header className="mb-6">
        <h2 className="text-base font-medium text-foreground">
          Feedback on this evaluation
        </h2>
        <p className="mt-1 max-w-2xl text-base text-muted-foreground">
          What did the AI get wrong? Specific examples + what the score should
          have been. This goes into prompt tuning — not seen by team members.
        </p>
      </header>

      <div className="max-w-3xl space-y-3">
        <MentionTextarea
          value={draft}
          onChange={setDraft}
          sources={mentionSources}
          placeholder={
            hasExisting
              ? "Edit your feedback..."
              : "e.g. The empathy score should have been a 3 — @Message 4 the agent did acknowledge the frustration, but the model missed it because..."
          }
          maxLength={MAX_CHARS}
          rows={5}
          className="text-base"
          disabled={isPending}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {hasExisting ? (
              <span>
                Last saved {formatRelative(myFeedback.updatedAt)}
              </span>
            ) : (
              <span>Markdown supported.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasExisting && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
                className="cursor-pointer text-muted-foreground hover:text-destructive"
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!canSave || isPending}
              className="cursor-pointer"
            >
              {hasExisting ? "Save changes" : "Save feedback"}
            </Button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      {otherFeedback.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-3 text-base font-medium text-foreground">
            From other reviewers
          </h3>
          <ul className="space-y-4">
            {otherFeedback.map((f) => (
              <FeedbackCard
                key={f.id}
                entry={f}
                messageIdByNumber={messageIdByNumber}
                onJumpToMessage={onJumpToMessage}
              />
            ))}
          </ul>
        </div>
      )}

      {!hasExisting && otherFeedback.length === 0 && (
        <EmptyState />
      )}
    </section>
  );
}

function FeedbackCard({
  entry,
  messageIdByNumber,
  onJumpToMessage,
}: {
  entry: FeedbackEntry;
  messageIdByNumber: Map<number, string>;
  onJumpToMessage: (messageId: string) => void;
}) {
  const displayName = entry.authorName?.trim() || entry.authorEmail;
  return (
    <li className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-medium text-foreground">
          {displayName}
        </span>
        <span className="text-sm text-muted-foreground">
          {formatRelative(entry.updatedAt)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-base text-foreground">
        <ReasoningWithMentions
          text={entry.feedbackText}
          messageIdByNumber={messageIdByNumber}
          onJump={onJumpToMessage}
        />
      </p>
    </li>
  );
}

function EmptyState() {
  return (
    <SharedEmptyState
      icon={Sparkles}
      description="Be the first to flag what the AI got wrong. Even a one-liner helps sharpen the next round of scoring."
      className="mt-6"
    />
  );
}
