"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBinaryPass } from "@/lib/qa/format-score";
import {
  HUE_TOKENS,
  hueForCategoryOrder,
  type CoachingHue,
} from "./colors";
import type { CoachingCategoryView } from "@/db/queries/coaching";

/** A citation chip displayed under a message bubble. Five-dot scale +
 *  category label + AI sparkle (when AI-suggested). Click opens Inspect
 *  with focus on the matching citation row. No colored circle — category
 *  color is a 2-px left-border tint + the dot scale fill. */
export function CitationChip({
  category,
  score,
  aiSuggested,
  onClick,
  active = false,
}: {
  category: CoachingCategoryView;
  score: number;
  aiSuggested: boolean;
  onClick: () => void;
  active?: boolean;
}) {
  const hue = hueForCategoryOrder(category.order);
  const styles = HUE_TOKENS[hue];
  const isBinary = category.scaleType === "binary";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${category.name}, ${
        isBinary ? (isBinaryPass(score) ? "pass" : "fail") : `${score} out of 5`
      }`}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-l-2 bg-card/60 px-2 py-0.5 text-sm font-medium shadow-sm transition-all hover:-translate-y-px hover:shadow-md",
        styles.border,
        "border-y-border border-r-border",
        styles.bgSoft,
        active && "shadow-md",
      )}
    >
      <span className={cn("min-w-0 truncate", styles.textDark)}>
        {category.name}
      </span>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {isBinary ? (
          <span className={cn("text-sm tabular-nums", styles.textDark)}>
            {isBinaryPass(score) ? "Pass" : "Fail"}
          </span>
        ) : (
          <DotScale value={score} hue={hue} />
        )}
      </span>
      {aiSuggested && (
        <Sparkles
          className={cn("size-2.5 shrink-0", styles.text)}
          aria-label="AI suggested"
        />
      )}
    </button>
  );
}

/** 5-dot scale visual for likert categories. Filled dots use the category
 *  hue; empties use a muted border-only dot. */
export function DotScale({ value, hue }: { value: number; hue: CoachingHue }) {
  const styles = HUE_TOKENS[hue];
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "inline-block size-1.5 rounded-full",
            n <= value ? styles.bg : "bg-transparent border border-border",
          )}
        />
      ))}
    </span>
  );
}
