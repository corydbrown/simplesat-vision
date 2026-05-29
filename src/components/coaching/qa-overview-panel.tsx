"use client";

import { cn } from "@/lib/utils";
import type {
  CoachingCategoryView,
  CoachingEvaluationView,
} from "@/db/queries/coaching";
import { CategoryCard } from "./category-card";
import { HUE_TOKENS, hueForOverallScore } from "./colors";

/** Default right-sidebar state — overall score ring + per-category cards.
 *  Replaced by InspectPanel when a message is selected. */
export function QaOverviewPanel({
  evaluation,
  activeCategoryId,
  focusedCategoryId,
  categoryRefs,
  messageIdByNumber,
  onToggleCategory,
  onFocusCategory,
  onJumpToMessage,
}: {
  evaluation: CoachingEvaluationView;
  activeCategoryId: string | null;
  focusedCategoryId: string | null;
  categoryRefs: React.MutableRefObject<
    Map<string, HTMLButtonElement | null>
  >;
  messageIdByNumber: Map<number, string>;
  onToggleCategory: (categoryId: string) => void;
  onFocusCategory: (categoryId: string) => void;
  onJumpToMessage: (messageId: string) => void;
}) {
  const hue = hueForOverallScore(evaluation.overallScore);

  return (
    <div className="rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="flex items-center gap-3 p-4">
        <ScoreRing value={evaluation.overallScore} hue={hue} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-medium text-foreground">
            {evaluation.scorecard.name}
          </div>
          <div className="text-sm text-muted-foreground">
            {evaluation.status === "edited"
              ? "Edited by reviewer"
              : `AI scored · ${evaluation.aiConfidence}% confidence`}
          </div>
        </div>
      </div>
      <div className="border-t border-border" />
      <div className="p-3">
        <div className="mb-2 px-1">
          <span className="text-sm font-medium text-muted-foreground">
            Categories
          </span>
        </div>
        <ul className="space-y-1.5">
          {evaluation.categories.map((cat) => (
            <li key={cat.id}>
              <CategoryCard
                ref={(el) => {
                  categoryRefs.current.set(cat.id, el);
                }}
                category={cat}
                active={activeCategoryId === cat.id}
                dimmed={
                  activeCategoryId !== null && activeCategoryId !== cat.id
                }
                isFocused={focusedCategoryId === cat.id}
                messageIdByNumber={messageIdByNumber}
                onToggle={() => onToggleCategory(cat.id)}
                onFocus={() => onFocusCategory(cat.id)}
                onJumpToMessage={onJumpToMessage}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ScoreRing({
  value,
  hue,
}: {
  value: number;
  hue: ReturnType<typeof hueForOverallScore>;
}) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (value / 100) * circumference;
  const styles = HUE_TOKENS[hue];
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="none"
        strokeWidth="4"
        className="stroke-border"
      />
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 24 24)"
        className={cn(
          "transition-[stroke-dashoffset] duration-700 ease-out",
          styles.stroke,
        )}
      />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-base font-semibold"
        style={{ fontSize: "14px" }}
      >
        {value}
      </text>
    </svg>
  );
}

// `CoachingCategoryView` exported here purely so callers can prop-drill it.
export type { CoachingCategoryView };
