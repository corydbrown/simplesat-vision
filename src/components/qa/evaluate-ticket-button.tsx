"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/shared/toast";
import { evaluateTicket } from "@/lib/qa/actions";

/** Manual "Evaluate" trigger for a ticket. Runs the provider-driven QA
 *  evaluation (a real LLM call takes a few seconds — hence the in-flight
 *  state), persists it, and navigates to the new Coaching detail page.
 *
 *  Two shapes:
 *   - default: the primary call-to-action shown when a ticket has never been
 *     scored ("Evaluate this conversation").
 *   - `reEvaluate`: a compact secondary action shown next to an existing
 *     score. Re-scoring stacks a fresh evaluation (history is a feature) and
 *     the new one becomes the head shown on the ticket. */
export function EvaluateTicketButton({
  ticketId,
  reEvaluate = false,
  disabledReason,
}: {
  ticketId: string;
  reEvaluate?: boolean;
  /** When set, the action is blocked and the reason is shown (no assignee /
   *  no messages). */
  disabledReason?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function run() {
    if (disabledReason || isPending) return;
    startTransition(async () => {
      try {
        const { evaluationId } = await evaluateTicket(ticketId);
        router.push(`/coaching/${evaluationId}`);
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Evaluation failed — try again.",
        );
      }
    });
  }

  const button = (
    <Button
      type="button"
      onClick={run}
      disabled={isPending || Boolean(disabledReason)}
      variant={reEvaluate ? "ghost" : "default"}
      size="sm"
      className="cursor-pointer"
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

  if (!disabledReason) return button;

  // Disabled — wrap in a tooltip explaining why. The span is the hover target
  // since a disabled button doesn't emit pointer events.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{disabledReason}</TooltipContent>
    </Tooltip>
  );
}
