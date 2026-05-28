"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { ArrowLeft, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CoachingCategoryView,
  CoachingMessageView,
  CoachingUserView,
} from "@/db/queries/coaching";
import type {
  CommentRow as CommentRowData,
  CoachingReaction,
} from "@/lib/qa/coaching";
import { CommentRow } from "./comment-row";
import { CommentComposer, type CommentComposerHandle } from "./comment-composer";
import { DotScale } from "./citation-chip";
import {
  HUE_TOKENS,
  hueForCategoryOrder,
} from "./colors";
import type { ReactionAggregate } from "./reaction-row";

export type CitationRowInput = {
  category: CoachingCategoryView;
  score: number;
  aiSuggested: boolean;
};

export type AddCitationState =
  | { kind: "closed" }
  | { kind: "picking-category" }
  | { kind: "picking-score"; categoryId: string };

export type InspectFocus =
  | { kind: "add-citation" }
  | { kind: "citation"; categoryId: string }
  | { kind: "composer" }
  | { kind: "comment"; commentId: string };

export type InspectPanelHandle = {
  focusComposer: () => void;
  blurComposer: () => void;
  isComposerFocused: () => boolean;
};

export function InspectPanel({
  ref,
  message,
  messageNumber,
  messageNumberById,
  citations,
  comments,
  reactionsByCommentId,
  commentAuthorsById,
  currentUserId,
  focus,
  isActiveSurface,
  addCitation,
  allCategories,
  editingCommentId,
  onBack,
  onFocusChange,
  onJumpToMessage,
  onSetCitationScore,
  onRemoveCitation,
  onStartAddCitation,
  onCancelAddCitation,
  onPickCategory,
  onPickScore,
  onSubmitComment,
  onEditComment,
  onDeleteComment,
  onToggleCommentReaction,
  onEditingDone,
  onUpArrowEmptyComposer,
}: {
  ref?: React.Ref<InspectPanelHandle>;
  message: CoachingMessageView;
  messageNumber: number;
  messageNumberById: Map<string, number>;
  citations: CitationRowInput[];
  comments: CommentRowData[];
  reactionsByCommentId: Map<string, ReactionAggregate[]>;
  commentAuthorsById: Record<string, CoachingUserView>;
  currentUserId: string;
  focus: InspectFocus;
  /** Whether Inspect is the active surface (left/right-arrow navigation). When
   *  it flips true, transfer DOM focus to whichever item `focus` points at —
   *  otherwise the keyboard nav looks active visually but `activeElement`
   *  stays on the message bubble. */
  isActiveSurface: boolean;
  addCitation: AddCitationState;
  /** All categories on this evaluation. The category picker filters out
   *  already-cited categories internally; the score picker needs the full
   *  list so it can still find the category right after attach (when it's
   *  no longer "available"). */
  allCategories: CoachingCategoryView[];
  editingCommentId: string | null;
  onBack: () => void;
  onFocusChange: (focus: InspectFocus) => void;
  onJumpToMessage: (messageId: string) => void;
  onSetCitationScore: (categoryId: string, score: number) => void;
  onRemoveCitation: (categoryId: string) => void;
  onStartAddCitation: () => void;
  onCancelAddCitation: () => void;
  onPickCategory: (categoryId: string) => void;
  onPickScore: (score: number) => void;
  onSubmitComment: (body: string) => void;
  onEditComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onToggleCommentReaction: (
    commentId: string,
    emoji: CoachingReaction,
  ) => void;
  onEditingDone: () => void;
  onUpArrowEmptyComposer: () => void;
}) {
  const composerRef = useRef<CommentComposerHandle | null>(null);
  const addCitationButtonRef = useRef<HTMLButtonElement | null>(null);
  const citationButtonRefs = useRef(
    new Map<string, HTMLButtonElement | null>(),
  );
  const isCustomer = message.authorRole === "customer";
  const showCitations = !isCustomer;
  const citedCategoryIds = new Set(citations.map((c) => c.category.id));
  const availableCategories = allCategories.filter(
    (c) => !citedCategoryIds.has(c.id),
  );

  useImperativeHandle(ref, () => ({
    focusComposer: () => composerRef.current?.focus(),
    blurComposer: () => composerRef.current?.blur(),
    isComposerFocused: () => composerRef.current?.isFocused() ?? false,
  }));

  // Transfer browser focus to whichever inspect item the parent has marked as
  // focused. Without this, arrow-key navigation looks visually right (the
  // ring renders via the `focused` prop) but `document.activeElement` stays
  // on the message bubble, so the next Enter/space goes to the wrong place.
  // Skip when Inspect isn't the active surface — otherwise we'd steal focus
  // away from the convo when the user is just hovering messages.
  useEffect(() => {
    if (!isActiveSurface) return;
    if (focus.kind === "composer") {
      composerRef.current?.focus();
      return;
    }
    if (focus.kind === "add-citation") {
      addCitationButtonRef.current?.focus();
      return;
    }
    if (focus.kind === "citation") {
      citationButtonRefs.current.get(focus.categoryId)?.focus();
      return;
    }
  }, [focus, isActiveSurface]);

  return (
    <div
      className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border bg-background/40 px-2 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to overview"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>
        <span className="pr-1 text-sm text-muted-foreground">
          Message {messageNumber}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {showCitations && (
            <section>
              {citations.length > 0 && (
                <div className="mb-2 px-1">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Citations
                  </h3>
                </div>
              )}
              <div className="space-y-1.5">
                {citations.map((c) => (
                  <InspectCitationRow
                    key={c.category.id}
                    buttonRef={(el) => {
                      citationButtonRefs.current.set(c.category.id, el);
                    }}
                    citation={c}
                    focused={
                      focus.kind === "citation" &&
                      focus.categoryId === c.category.id
                    }
                    messageNumberById={messageNumberById}
                    onFocus={() =>
                      onFocusChange({
                        kind: "citation",
                        categoryId: c.category.id,
                      })
                    }
                    onSetScore={(s) => onSetCitationScore(c.category.id, s)}
                    onRemove={() => onRemoveCitation(c.category.id)}
                    onJumpToMessage={onJumpToMessage}
                  />
                ))}

                {addCitation.kind === "picking-category" && (
                  <CategoryPicker
                    categories={availableCategories}
                    onPick={onPickCategory}
                    onCancel={onCancelAddCitation}
                  />
                )}

                {addCitation.kind === "picking-score" &&
                  (() => {
                    // Look in *all* categories — by the time we're picking a
                    // score, the chosen category has already been attached,
                    // so it's no longer in `availableCategories`.
                    const cat = allCategories.find(
                      (c) => c.id === addCitation.categoryId,
                    );
                    if (!cat) return null;
                    return (
                      <ScorePicker
                        category={cat}
                        onPick={onPickScore}
                        onCancel={onCancelAddCitation}
                      />
                    );
                  })()}

                {addCitation.kind === "closed" &&
                  availableCategories.length > 0 && (
                    <button
                      ref={addCitationButtonRef}
                      type="button"
                      onClick={onStartAddCitation}
                      onFocus={() => onFocusChange({ kind: "add-citation" })}
                      tabIndex={0}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus:outline-none",
                        focus.kind === "add-citation" &&
                          "ring-2 ring-ring",
                      )}
                    >
                      <Plus className="size-3.5" />
                      <span>Add citation</span>
                    </button>
                  )}
              </div>
            </section>
          )}

          {comments.length > 0 && (
            <section>
              <div className="mb-2 px-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Comments
                </h3>
              </div>
              <ul className="space-y-3">
                {comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    author={commentAuthorsById[c.authorId] ?? null}
                    isOwn={c.authorId === currentUserId}
                    reactions={reactionsByCommentId.get(c.id) ?? []}
                    onToggleReaction={(emoji) =>
                      onToggleCommentReaction(c.id, emoji)
                    }
                    onSaveEdit={(body) => onEditComment(c.id, body)}
                    onDelete={() => onDeleteComment(c.id)}
                    editingExternally={editingCommentId === c.id}
                    onEditExternallyDone={onEditingDone}
                  />
                ))}
              </ul>
            </section>
          )}

          <section>
            <CommentComposer
              ref={composerRef}
              onSubmit={onSubmitComment}
              onUpArrowEmpty={onUpArrowEmptyComposer}
              onFocus={() => onFocusChange({ kind: "composer" })}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function InspectCitationRow({
  buttonRef,
  citation,
  focused,
  messageNumberById,
  onFocus,
  onSetScore,
  onRemove,
  onJumpToMessage,
}: {
  buttonRef?: (el: HTMLButtonElement | null) => void;
  citation: CitationRowInput;
  focused: boolean;
  messageNumberById: Map<string, number>;
  onFocus: () => void;
  onSetScore: (s: number) => void;
  onRemove: () => void;
  onJumpToMessage: (messageId: string) => void;
}) {
  const styles = HUE_TOKENS[hueForCategoryOrder(citation.category.order)];
  const isBinary = citation.category.scaleType === "binary";

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        styles.borderSoft,
        styles.bgSoft,
        focused && "shadow-sm ring-1 ring-inset",
        focused && styles.ring,
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={onFocus}
        onFocus={onFocus}
        tabIndex={focused ? 0 : -1}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left focus:outline-none"
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-base font-medium",
            styles.textDark,
          )}
        >
          {citation.category.name}
        </span>
        <span className="shrink-0">
          {isBinary ? (
            <span className={cn("text-sm tabular-nums", styles.textDark)}>
              {citation.score === 1 ? "Pass" : "Fail"}
            </span>
          ) : (
            <DotScale
              value={citation.score}
              hue={hueForCategoryOrder(citation.category.order)}
            />
          )}
        </span>
        {citation.aiSuggested && (
          <Sparkles
            className={cn("size-3 shrink-0 opacity-80", styles.text)}
            aria-label="AI suggested"
          />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${citation.category.name}`}
          className={cn(
            "shrink-0 cursor-pointer rounded-md p-1 transition-colors",
            styles.textDark,
            "hover:bg-background/70",
          )}
        >
          <X className="size-3.5" />
        </button>
      </button>
      {focused && (
        <div className="space-y-2 px-3 pb-2.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {!isBinary && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onSetScore(n)}
                  className={cn(
                    "size-8 cursor-pointer rounded-md border text-sm font-medium tabular-nums transition-all hover:scale-105",
                    n === citation.score
                      ? cn(styles.bg, "border-transparent text-white shadow-sm")
                      : cn("border-border bg-background", styles.textDark),
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {citation.category.aiReasoning && (
            <p className="text-sm italic text-muted-foreground">
              <ReasoningText
                text={citation.category.aiReasoning}
                messageNumberById={messageNumberById}
                onJump={onJumpToMessage}
              />
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReasoningText({
  text,
  messageNumberById,
  onJump,
}: {
  text: string;
  messageNumberById: Map<string, number>;
  onJump: (messageId: string) => void;
}) {
  const parts: React.ReactNode[] = [];
  const re = /msg_(\w+)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const msgId = m[0];
    const num = messageNumberById.get(msgId);
    parts.push(
      <button
        key={`r${i++}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onJump(msgId);
        }}
        className="cursor-pointer rounded-sm bg-accent/60 px-1 not-italic text-foreground transition-colors hover:bg-accent"
      >
        Message {num ?? m[1]}
      </button>,
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function CategoryPicker({
  categories,
  onPick,
  onCancel,
}: {
  categories: CoachingCategoryView[];
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/40 p-2">
      <div className="mb-1 flex items-center justify-between px-1 text-sm text-muted-foreground">
        <span>Pick a category</span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <ul className="space-y-0.5">
        {categories.map((cat) => {
          const styles = HUE_TOKENS[hueForCategoryOrder(cat.order)];
          return (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onPick(cat.id)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
              >
                <span
                  className={cn("size-2 shrink-0 rounded-full", styles.bg)}
                  aria-hidden
                />
                <span className="flex-1 truncate text-base text-foreground">
                  {cat.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScorePicker({
  category,
  onPick,
  onCancel,
}: {
  category: CoachingCategoryView;
  onPick: (n: number) => void;
  onCancel: () => void;
}) {
  const styles = HUE_TOKENS[hueForCategoryOrder(category.order)];
  const isBinary = category.scaleType === "binary";
  const choices = isBinary ? [0, 1] : [1, 2, 3, 4, 5];
  return (
    <div
      className={cn(
        "rounded-lg border p-2 animate-in fade-in slide-in-from-top-1 duration-150",
        styles.borderSoft,
        styles.bgSoft,
      )}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            styles.textDark,
          )}
        >
          <span className={cn("size-1.5 rounded-full", styles.bg)} />
          Score {category.name}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <div className="flex items-center justify-between gap-1 px-1 pt-1">
        {choices.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-sm transition-all hover:scale-105",
              "border-border bg-background",
              styles.textDark,
            )}
          >
            <span className="text-base font-medium tabular-nums">
              {isBinary ? (n === 1 ? "Pass" : "Fail") : n}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
