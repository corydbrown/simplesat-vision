"use client";

import { cn } from "@/lib/utils";
import type { CoachingCategoryView } from "@/db/queries/coaching";
import {
  HUE_TOKENS,
  hueForCategoryOrder,
} from "./colors";

/** Single category card — score + weight + autofail tag + reasoning when
 *  active. Clicking toggles the page-level "mute uncited messages + outline
 *  cited" effect (handled by the parent). Keyboard: when this card is
 *  focused via the right-arrow nav, Enter triggers the same toggle. */
export function CategoryCard({
  ref,
  category,
  active,
  dimmed,
  isFocused,
  onToggle,
  onFocus,
}: {
  ref?: (el: HTMLButtonElement | null) => void;
  category: CoachingCategoryView;
  active: boolean;
  dimmed: boolean;
  isFocused: boolean;
  onToggle: () => void;
  onFocus: () => void;
}) {
  const styles = HUE_TOKENS[hueForCategoryOrder(category.order)];
  const isBinary = category.scaleType === "binary";
  const scoreLabel = isBinary
    ? category.effectiveScore === 1
      ? "Pass"
      : "Fail"
    : `${category.effectiveScore}/5`;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      onFocus={onFocus}
      tabIndex={isFocused ? 0 : -1}
      className={cn(
        "group relative w-full cursor-pointer overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all duration-200",
        active
          ? cn(styles.bgSoft, styles.border, "shadow-sm")
          : "border-transparent bg-transparent hover:bg-accent/50",
        isFocused && !active && "ring-2 ring-ring",
        dimmed && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 w-1 rounded-r-full transition-all duration-200",
          styles.bg,
          active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
        )}
      />
      <div className="flex items-center justify-between gap-2 pl-2">
        <span
          className={cn(
            "truncate text-base font-medium",
            active ? styles.textDark : "text-foreground",
          )}
        >
          {category.name}
        </span>
        <span
          className={cn(
            "shrink-0 text-sm font-medium tabular-nums",
            active ? styles.textDark : "text-muted-foreground",
          )}
        >
          {scoreLabel}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 pl-2 text-sm text-muted-foreground">
        <span>{category.weightPercent}% weight</span>
        {category.isAutofail && (
          <>
            <span aria-hidden>·</span>
            <span className="font-medium text-red-darker">Autofail</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{category.highlightedMessageIds.length} cited</span>
      </div>
      {active && category.aiReasoning && (
        <p className="mt-2 pl-2 text-base text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
          {category.aiReasoning.split(/(msg_\d+)/g).map((part, i) => {
            const m = part.match(/^msg_(\d+)$/);
            if (m) return <span key={i}>Message {m[1]}</span>;
            return <span key={i}>{part}</span>;
          })}
        </p>
      )}
    </button>
  );
}
