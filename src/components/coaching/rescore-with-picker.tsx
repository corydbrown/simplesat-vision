"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Loader2 } from "lucide-react";
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
import { useToast } from "@/components/shared/toast";
import { evaluateTicket } from "@/lib/qa/actions";

type Props = {
  ticketId: string;
  /** All live (non-archived) scorecards for the workspace. */
  scorecards: LiveScorecardPickerRow[];
  /** Scorecard id of the currently displayed evaluation — used to disable
   *  the matching menu item (re-scoring against the same scorecard is fine,
   *  but call that out as "Re-run" instead of "Switch to"). */
  currentScorecardId: string;
};

/** Header action that re-scores the current ticket against a chosen scorecard.
 *  Stays inside the coaching detail header's actions slot (SVP-229's lane —
 *  SVP-231 owns a new body section, SVP-233 owns the footer). When only one
 *  live scorecard exists the dropdown still works as a one-click "Re-run"
 *  rather than degrading to a separate UI. */
export function RescoreWithPicker({
  ticketId,
  scorecards,
  currentScorecardId,
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

  const onPick = (scorecardId: string) => {
    if (isPending) return;
    startPending(async () => {
      try {
        const { evaluationId } = await evaluateTicket(ticketId, {
          scorecardId,
        });
        router.push(`/coaching/${evaluationId}`);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not re-score ticket");
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          className="cursor-pointer"
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCcw size={14} />
          )}
          Re-score with…
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Score against</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {scorecards.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => onPick(s.id)}
            className="cursor-pointer"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base text-foreground">
                {s.name}
              </span>
              <span className="text-sm text-muted-foreground">
                v{s.version}
                {s.id === currentScorecardId ? " · current" : ""}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
