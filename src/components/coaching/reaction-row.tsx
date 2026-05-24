"use client";

import { SmilePlus } from "lucide-react";
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

export type ReactionAggregate = {
  emoji: CoachingReaction;
  reactors: string[];
  reactedByMe: boolean;
};

/** Slack-style reaction chip row. Renders existing aggregates plus a
 *  `+ emoji` affordance that opens an inline 6-row curated picker. The
 *  picker's `side` hint keeps the popover column-contained (agent bubbles
 *  open it LEFT, customer bubbles RIGHT, QA sidebar LEFT). */
export function ReactionRow({
  aggregates,
  onToggle,
  pickerSide,
  /** When true, the `+` affordance is always rendered. When false it only
   *  appears once there's already at least one reaction (saves vertical
   *  space on quiet messages — the hover popup is the entry point). */
  alwaysShowAdd = false,
  size = "md",
  align = "start",
}: {
  aggregates: ReactionAggregate[];
  onToggle: (emoji: CoachingReaction) => void;
  pickerSide: "left" | "right";
  alwaysShowAdd?: boolean;
  size?: "sm" | "md";
  align?: "start" | "end";
}) {
  const hasReactions = aggregates.length > 0;
  if (!hasReactions && !alwaysShowAdd) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        align === "end" && "justify-end",
      )}
    >
      {aggregates.map((agg) => (
        <ReactionChip
          key={agg.emoji}
          aggregate={agg}
          onToggle={() => onToggle(agg.emoji)}
          size={size}
        />
      ))}
      <ReactionAddButton
        onPick={onToggle}
        pickerSide={pickerSide}
        aggregates={aggregates}
        size={size}
      />
    </div>
  );
}

function ReactionChip({
  aggregate,
  onToggle,
  size,
}: {
  aggregate: ReactionAggregate;
  onToggle: () => void;
  size: "sm" | "md";
}) {
  const { emoji, reactors, reactedByMe } = aggregate;
  const display =
    reactors.length <= 4
      ? reactors.join(", ")
      : `${reactors.slice(0, 3).join(", ")} and ${reactors.length - 3} more`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={`${emoji} from ${display}`}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full border text-sm transition-colors",
            size === "sm" ? "h-5 px-1.5" : "h-6 px-2",
            reactedByMe
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-card text-foreground hover:bg-accent",
          )}
        >
          <span aria-hidden>{emoji}</span>
          <span className="tabular-nums">{reactors.length}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-sm">
        {display}
      </TooltipContent>
    </Tooltip>
  );
}

function ReactionAddButton({
  onPick,
  pickerSide,
  aggregates,
  size,
}: {
  onPick: (emoji: CoachingReaction) => void;
  pickerSide: "left" | "right";
  aggregates: ReactionAggregate[];
  size: "sm" | "md";
}) {
  const reactedSet = new Set(
    aggregates.filter((a) => a.reactedByMe).map((a) => a.emoji),
  );
  // Radix Popover's `align` controls which corner anchors. Pair it with
  // `side="top"` so the picker visually expands upward and toward the
  // requested column edge.
  const align = pickerSide === "left" ? "end" : "start";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Add reaction"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-border bg-transparent text-muted-foreground transition-colors hover:border-solid hover:bg-accent hover:text-foreground",
            size === "sm" ? "h-5 px-1" : "h-6 px-1.5",
          )}
        >
          <SmilePlus className={size === "sm" ? "size-3" : "size-3.5"} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align={align}
        className="w-auto p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5">
          {COACHING_REACTIONS.map((emoji) => {
            const reactedByMe = reactedSet.has(emoji);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
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
