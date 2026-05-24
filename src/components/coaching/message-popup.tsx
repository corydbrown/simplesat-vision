"use client";

import {
  CornerDownLeft,
  MessageSquarePlus,
  SmilePlus,
  Tag,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Slack-style icon-only action toolbar that appears on hover OR keyboard
 * focus of a message bubble. Sits top-right (or top-left on a customer
 * bubble) with `bg-popover` + shadow so the underlying sender/timestamp
 * never bleeds through.
 *
 * No keyboard-hint badges — V1 ships keyboard hints hidden by default. The
 * `?` cheat-sheet dialog is the full keyboard reference.
 */
export function MessagePopup({
  side,
  disableCite,
  onComment,
  onCite,
  onReact,
  onInspect,
}: {
  side: "right" | "left";
  /** Customer messages aren't categorize-able — hide the cite icon. */
  disableCite: boolean;
  onComment: () => void;
  onCite: () => void;
  onReact: () => void;
  onInspect: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute -top-3 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-md animate-in fade-in slide-in-from-bottom-1 duration-100",
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
      <PopupIcon
        label="React"
        icon={<SmilePlus className="size-4" />}
        onClick={onReact}
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
