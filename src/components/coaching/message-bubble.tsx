"use client";

import { Avatar } from "@/components/shared/avatar";
import { colorFromName, initialsFromName } from "@/lib/color-from-name";
import type {
  CoachingCategoryView,
  CoachingMessageView,
} from "@/db/queries/coaching";
import { formatSmartTime } from "@/lib/format";
import type { CoachingReaction } from "@/lib/qa/coaching";
import { cn } from "@/lib/utils";
import { CitationChip } from "./citation-chip";
import { CommentIcon } from "./comment-icon";
import { HUE_TOKENS, type CoachingHue } from "./colors";
import { MessagePopup } from "./message-popup";
import { ReactionRow, type ReactionAggregate } from "./reaction-row";

export type BubbleCitation = {
  category: CoachingCategoryView;
  score: number;
  aiSuggested: boolean;
};

export function MessageBubble({
  ref,
  message,
  messageNumber,
  citations,
  reactions,
  hasComments,
  isFocused,
  isInspected,
  isDimmed,
  isFlashing,
  outlineHue,
  popupVisible,
  onHoverChange,
  onClickBubble,
  onClickComment,
  onClickCite,
  onClickReact,
  onClickInspect,
  onClickCitationChip,
  onToggleReaction,
}: {
  ref?: (el: HTMLDivElement | null) => void;
  message: CoachingMessageView;
  messageNumber: number;
  citations: BubbleCitation[];
  reactions: ReactionAggregate[];
  hasComments: boolean;
  isFocused: boolean;
  isInspected: boolean;
  isDimmed: boolean;
  isFlashing: boolean;
  outlineHue: CoachingHue | null;
  popupVisible: boolean;
  onHoverChange: (h: boolean) => void;
  onClickBubble: () => void;
  onClickComment: () => void;
  onClickCite: () => void;
  onClickReact: () => void;
  onClickInspect: () => void;
  onClickCitationChip: (categoryId: string) => void;
  onToggleReaction: (emoji: CoachingReaction) => void;
}) {
  const isAgent = message.authorRole === "agent";
  const isCustomer = message.authorRole === "customer";
  const isSystem = message.authorRole === "system";

  const avatarBg =
    message.authorAvatarColor ?? colorFromName(message.authorName);
  const outlineStyles = outlineHue ? HUE_TOKENS[outlineHue] : null;
  const hasReactions = reactions.length > 0;
  // Reaction picker opens INTO the column — agent bubbles open LEFT, customer
  // and system bubbles open RIGHT.
  const pickerSide: "left" | "right" = isAgent ? "left" : "right";

  return (
    <div
      ref={ref}
      data-msg-id={message.id}
      className={cn(
        "scroll-mt-4 flex gap-3 transition-all duration-300 ease-out",
        isAgent ? "flex-row-reverse" : "flex-row",
        isDimmed && "opacity-30 blur-[0.5px]",
      )}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <Avatar
        bg={avatarBg}
        initials={initialsFromName(message.authorName)}
        size="lg"
      />

      <div
        className={cn(
          "relative min-w-0 max-w-[78%] flex-1 space-y-1",
          isAgent && "text-right",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 text-sm",
            isAgent ? "justify-end" : "justify-start",
          )}
        >
          <span className="font-medium text-foreground">
            {message.authorName}
          </span>
          <span className="text-muted-foreground">
            {formatSmartTime(new Date(message.createdAt))}
          </span>
        </div>

        <div
          className={cn(
            "relative inline-block max-w-full",
            isAgent ? "self-end" : "self-start",
          )}
        >
          {popupVisible && (
            <MessagePopup
              side="right"
              disableCite={!isAgent}
              onComment={onClickComment}
              onCite={onClickCite}
              onReact={onClickReact}
              onInspect={onClickInspect}
            />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClickBubble();
            }}
            className={cn(
              "group relative inline-block max-w-full cursor-pointer rounded-2xl border px-4 py-3 pr-9 text-left text-base transition-all duration-200 ease-out",
              isAgent &&
                "rounded-tr-sm border-primary/20 bg-primary/10 text-foreground",
              isCustomer &&
                "rounded-tl-sm border-border bg-card text-foreground",
              isSystem &&
                "rounded-tl-sm border-dashed border-border bg-muted/40 text-muted-foreground",
              "hover:-translate-y-px hover:shadow-md",
              isFocused &&
                !isInspected &&
                "ring-2 ring-ring ring-offset-2 ring-offset-background -translate-y-px shadow-md",
              isInspected && "ring-2 ring-primary shadow-md -translate-y-px",
              outlineStyles && cn("ring-2", outlineStyles.ring),
              isFlashing && "ring-2 ring-ring shadow-lg -translate-y-px",
            )}
          >
            <span
              aria-hidden
              className="absolute right-2 top-1.5 select-none text-xs font-medium tabular-nums text-muted-foreground/60"
            >
              M{messageNumber}
            </span>
            {message.body}
          </button>
        </div>

        {(citations.length > 0 || hasComments || hasReactions) && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5 pt-1",
              isAgent ? "justify-end" : "justify-start",
            )}
          >
            {citations.map((c) => (
              <CitationChip
                key={c.category.id}
                category={c.category}
                score={c.score}
                aiSuggested={c.aiSuggested}
                onClick={() => onClickCitationChip(c.category.id)}
              />
            ))}
            {hasComments && <CommentIcon onClick={onClickComment} />}
            {hasReactions && (
              <ReactionRow
                aggregates={reactions}
                onToggle={onToggleReaction}
                pickerSide={pickerSide}
                size="md"
                align={isAgent ? "end" : "start"}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
