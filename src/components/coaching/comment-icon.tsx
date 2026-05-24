"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/** Single 💬 icon shown under a bubble that has at least one comment.
 *  Count intentionally omitted — count lives in Inspect. Clicking opens
 *  Inspect with the comment composer focused so a reply is one keystroke
 *  away. */
export function CommentIcon({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label="Open comments"
      className={cn(
        "inline-flex h-6 cursor-pointer items-center justify-center rounded-full border border-border bg-card/60 px-2 text-muted-foreground transition-colors hover:-translate-y-px hover:bg-accent hover:text-foreground hover:shadow-sm",
      )}
    >
      <MessageSquare className="size-3.5" aria-hidden />
    </button>
  );
}
