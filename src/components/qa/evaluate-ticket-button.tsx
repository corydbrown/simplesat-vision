"use client";

import { ChevronDown, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
import { toast } from "sonner";
import { evaluateTicket } from "@/lib/qa/actions";

/** Manual "Evaluate" trigger for a ticket. Runs the provider-driven QA
 *  evaluation (a real LLM call takes a few seconds — hence the in-flight
 *  state), persists it, and navigates to the new Coaching detail page.
 *
 *  SVP-242: split-button shape. The main face evaluates with no explicit
 *  override — server-side resolution picks the workspace default, falling
 *  through to "oldest live scorecard" when no default is set. The caret
 *  dropdown lets the user pick any other live scorecard for this one click;
 *  the workspace default is unaffected.
 *
 *  Two visual modes:
 *   - default: the primary call-to-action shown when a ticket has never been
 *     scored ("Evaluate this conversation").
 *   - `reEvaluate`: a compact secondary action shown next to an existing
 *     score. Re-scoring stacks a fresh evaluation (history is a feature) and
 *     the new one becomes the head shown on the ticket.
 *
 *  The caret is rendered only when the workspace has more than one live
 *  scorecard — a single-scorecard picker fails Simple. */
export function EvaluateTicketButton({
  ticketId,
  scorecards,
  defaultScorecardId,
  reEvaluate = false,
  disabledReason,
}: {
  ticketId: string;
  /** All live (non-archived) scorecards for the workspace. */
  scorecards: LiveScorecardPickerRow[];
  /** Workspace's default scorecard id, or null. Surfaced as a "· default"
   *  marker on the matching caret item. The main face does NOT pass this
   *  to `evaluateTicket` — server-side resolution handles default lookup. */
  defaultScorecardId: string | null;
  reEvaluate?: boolean;
  /** When set, the action is blocked and the reason is shown (no assignee /
   *  no messages). */
  disabledReason?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const showCaret = scorecards.length > 1;
  const isBlocked = isPending || Boolean(disabledReason);

  function run(scorecardId?: string) {
    if (isBlocked) return;
    startTransition(async () => {
      try {
        const { evaluationId } = await evaluateTicket(
          ticketId,
          scorecardId ? { scorecardId } : undefined,
        );
        router.push(`/evaluations/${evaluationId}`);
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Evaluation failed — try again.",
        );
      }
    });
  }

  const mainButton = (
    <Button
      type="button"
      onClick={() => run()}
      disabled={isBlocked}
      variant={reEvaluate ? "ghost" : "default"}
      size="sm"
      className={`cursor-pointer ${showCaret ? "rounded-r-none" : ""}`}
    >
      {isPending ? (
        <>
          <Loader2 className="animate-spin" />
          Evaluating…
        </>
      ) : reEvaluate ? (
        <>
          <RotateCcw />
          Re-evaluate
        </>
      ) : (
        <>
          <Sparkles />
          Evaluate this conversation
        </>
      )}
    </Button>
  );

  const caret = showCaret ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          disabled={isBlocked}
          variant={reEvaluate ? "ghost" : "default"}
          size="sm"
          aria-label="Pick a scorecard"
          className="cursor-pointer rounded-l-none border-l border-l-primary-foreground/20 px-2"
        >
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Evaluate with</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {scorecards.map((s) => (
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
                v{s.version}
                {s.id === defaultScorecardId ? " · default" : ""}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const group = showCaret ? (
    <div className="inline-flex">
      {mainButton}
      {caret}
    </div>
  ) : (
    mainButton
  );

  if (!disabledReason) return group;

  // Disabled — wrap in a tooltip explaining why. The span is the hover target
  // since a disabled button doesn't emit pointer events.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{group}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{disabledReason}</TooltipContent>
    </Tooltip>
  );
}
