"use client";

import {
  CornerDownLeft,
  MessageSquarePlus,
  SmilePlus,
  Tag,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  COACHING_REACTIONS,
  type CoachingReaction,
} from "@/lib/qa/coaching/reactions";
import { cn } from "@/lib/utils";

/**
 * Slack-style icon-only action toolbar that appears on hover OR keyboard
 * focus of a message bubble. Sits ~50/50 over the bubble's top edge with
 * `bg-popover` + shadow so the underlying sender/timestamp never bleeds
 * through.
 *
 * The React button is itself a Popover trigger so the emoji picker opens
 * directly from the popup — it doesn't depend on a `+` affordance in the
 * chip row (which only renders for messages that already have reactions).
 */
export function MessagePopup({
  side,
  disableCite,
  reactionPickerOpen,
  onReactionPickerOpenChange,
  onPickReaction,
  reactedEmojis,
  onComment,
  onCite,
  onInspect,
}: {
  side: "right" | "left";
  /** Customer messages aren't categorize-able — hide the cite icon. */
  disableCite: boolean;
  reactionPickerOpen: boolean;
  onReactionPickerOpenChange: (open: boolean) => void;
  onPickReaction: (emoji: CoachingReaction) => void;
  reactedEmojis: Set<CoachingReaction>;
  onComment: () => void;
  onCite: () => void;
  onInspect: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute -top-4 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-md animate-in fade-in slide-in-from-bottom-1 duration-100",
        side === "right" ? "right-2" : "left-2",
      )}
    >
      <PopupIcon
        label="Comment"
        icon={<MessageSquarePlus className="size-4" />}
        onClick={onComment}
      />
      {!disableCite && (
        <PopupIcon
          label="Cite"
          icon={<Tag className="size-4" />}
          onClick={onCite}
        />
      )}
      <ReactPopupButton
        side={side}
        open={reactionPickerOpen}
        onOpenChange={onReactionPickerOpenChange}
        onPick={onPickReaction}
        reactedEmojis={reactedEmojis}
      />
      <PopupIcon
        label="Inspect"
        icon={<CornerDownLeft className="size-4" />}
        onClick={onInspect}
      />
    </div>
  );
}

function PopupIcon({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent"
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-sm">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ReactPopupButton({
  side,
  open,
  onOpenChange,
  onPick,
  reactedEmojis,
}: {
  side: "right" | "left";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (emoji: CoachingReaction) => void;
  reactedEmojis: Set<CoachingReaction>;
}) {
  // Mirror ReactionRow's alignment: agent bubbles (side=right popup) open the
  // picker toward the left column edge; customer bubbles open it toward the
  // right. Radix uses `align` paired with `side="top"`.
  const align = side === "right" ? "end" : "start";
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger
            type="button"
            // Reused as the R-hotkey selector — keep in sync with the chip-row
            // add button so a single querySelector works in both states.
            aria-label="Add reaction"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent"
          >
            <SmilePlus className="size-4" />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-sm">
          React
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align={align}
        className="w-auto p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5">
          {COACHING_REACTIONS.map((emoji) => {
            const reactedByMe = reactedEmojis.has(emoji);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onPick(emoji);
                  onOpenChange(false);
                }}
                aria-label={`React with ${emoji}`}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-md text-lg transition-all hover:scale-110 hover:bg-accent",
                  reactedByMe && "bg-primary/10",
                )}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
