"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, RefreshCcw } from "lucide-react";
import type { LiveScorecardPickerRow } from "@/db/queries/scorecards";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/shared/toast";
import { evaluateTicket } from "@/lib/qa/actions";

type Props = {
  ticketId: string;
  /** All live (non-archived) scorecards for the workspace. */
  scorecards: LiveScorecardPickerRow[];
  /** Scorecard id of the currently displayed evaluation — used to mark the
   *  matching menu item as "current" (re-scoring against the same scorecard
   *  is fine, just label it so the user knows what'll happen). */
  currentScorecardId: string;
  /** SVP-242: workspace-default scorecard id, or null if none is set. Drives
   *  the main-face click target — clicking "Re-evaluate" re-scores against
   *  the workspace default rather than the current evaluation's scorecard. */
  defaultScorecardId: string | null;
};

/** Header action that re-scores the current ticket. Split-button shape
 *  (SVP-242):
 *   - Main face: triggers a re-evaluation against the workspace default
 *     scorecard. When no default is set, server-side resolution falls through
 *     to "oldest live scorecard" — same as the bare button before SVP-242.
 *   - Caret: picker dropdown listing every live scorecard. Click any to
 *     re-score against that one for this single click (workspace default is
 *     unaffected).
 *
 *  The caret is hidden when only one live scorecard exists — a 1-option
 *  picker fails Simple. Both surfaces share the same `evaluateTicket` action
 *  and navigate to the resulting `/evaluations/<evaluationId>` page. */
export function RescoreWithPicker({
  ticketId,
  scorecards,
  currentScorecardId,
  defaultScorecardId,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startPending] = useTransition();

  if (scorecards.length === 0) {
    // Defensive — `scoreAndPersistTicket` auto-inits IQS if a workspace has
    // none, so the list shouldn't be empty in practice. Hide the picker
    // rather than render a dead control.
    return null;
  }

  const showCaret = scorecards.length > 1;
  const defaultScorecardName =
    scorecards.find((s) => s.id === defaultScorecardId)?.name ?? null;

  const run = (scorecardId?: string) => {
    if (isPending) return;
    startPending(async () => {
      try {
        const { evaluationId } = await evaluateTicket(
          ticketId,
          scorecardId ? { scorecardId } : undefined,
        );
        router.push(`/evaluations/${evaluationId}`);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not re-score ticket");
      }
    });
  };

  const mainButton = (
    <Button
      type="button"
      onClick={() => run()}
      variant="outline"
      size="sm"
      disabled={isPending}
      className={`cursor-pointer ${showCaret ? "rounded-r-none border-r-0" : ""}`}
    >
      {isPending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <RefreshCcw size={14} />
      )}
      Re-evaluate
    </Button>
  );

  // Tooltip-wrap the main face when there's a workspace default to call out
  // which scorecard the click will use. Skipped when no default exists —
  // the fallback (oldest-first) isn't worth surfacing to the user as a
  // promise the system might not keep.
  const wrappedMain = defaultScorecardName ? (
    <Tooltip>
      <TooltipTrigger asChild>{mainButton}</TooltipTrigger>
      <TooltipContent side="bottom">
        Re-evaluate with {defaultScorecardName}
      </TooltipContent>
    </Tooltip>
  ) : (
    mainButton
  );

  if (!showCaret) return wrappedMain;

  return (
    <div className="inline-flex">
      {wrappedMain}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            aria-label="Pick a scorecard"
            className="cursor-pointer rounded-l-none px-2"
          >
            <ChevronDown size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel>Re-score with</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {scorecards.map((s) => {
            const tags: string[] = [`v${s.version}`];
            if (s.id === defaultScorecardId) tags.push("default");
            if (s.id === currentScorecardId) tags.push("current");
            return (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => run(s.id)}
                className="cursor-pointer"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base text-foreground">
                    {s.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tags.join(" · ")}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
