"use client";

import { Loader2, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared/toast";
import {
  evaluateTicket,
  searchScorableTickets,
  type ScorableTicketRow,
} from "@/lib/qa/actions";

/** "New evaluation" entry on the Coaching page: pick any scorable ticket and
 *  run the scorecard against it, landing on the resulting Coaching detail.
 *  Secondary to the ticket-detail "Evaluate" flow — this is the start-from-
 *  Coaching path. Only tickets with messages + an assigned agent are listed
 *  (the two preconditions `scoreAndPersistTicket` enforces). */
export function NewEvaluationDialog() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ScorableTicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Debounced search, mirroring the scorecard editor's ticket picker.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await searchScorableTickets(query);
        if (!cancelled) setRows(res);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, query]);

  function evaluate(row: ScorableTicketRow) {
    if (isPending) return;
    setPendingId(row.id);
    startTransition(async () => {
      try {
        const { evaluationId } = await evaluateTicket(row.id);
        setOpen(false);
        router.push(`/coaching/${evaluationId}`);
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Evaluation failed — try again.",
        );
        setPendingId(null);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return; // don't close mid-evaluation
        setOpen(next);
        if (!next) {
          setQuery("");
          setPendingId(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="cursor-pointer">
          <Plus />
          New evaluation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Evaluate a conversation</DialogTitle>
          <DialogDescription>
            Pick a ticket to score against the default scorecard. You&rsquo;ll
            land on its coaching breakdown.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by subject or customer…"
          className="h-9"
        />

        <div className="max-h-80 overflow-y-auto rounded-md border border-border">
          {loading && rows.length === 0 ? (
            <div className="px-3 py-8 text-center text-base text-muted-foreground">
              Searching…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-3 py-8 text-center text-base text-muted-foreground">
              {query.length === 0
                ? "No scorable tickets yet"
                : "No matches"}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => {
                const rowPending = isPending && pendingId === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => evaluate(row)}
                      disabled={isPending}
                      className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/40 disabled:cursor-default disabled:opacity-60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base text-foreground">
                          {row.subject}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          {row.customerName ?? "Unknown customer"}
                          {row.alreadyScored && " · already evaluated"}
                        </div>
                      </div>
                      {rowPending ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <Sparkles className="size-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
