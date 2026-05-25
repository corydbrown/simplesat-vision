"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  previewScoreWithDraft,
  searchScoredTickets,
  type PreviewScorecardResult,
  type TicketPickerRow,
} from "@/lib/scorecards/actions";
import type { ScorecardScaleType } from "@/db/schema";

type DraftScorecard = {
  id: string;
  name: string;
  version: number;
  categories: {
    id: string;
    name: string;
    description: string;
    weightPercent: number;
    scaleType: ScorecardScaleType;
    isAutofail: boolean;
    order: number;
    criteria: {
      id: string;
      text: string;
      anchor5: string;
      anchor3: string;
      anchor1: string;
    }[];
  }[];
};

export function TicketPreviewPanel({
  scorecard,
}: {
  scorecard: DraftScorecard;
}) {
  const [selected, setSelected] = useState<TicketPickerRow | null>(null);
  const [result, setResult] = useState<PreviewScorecardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, startPreviewing] = useTransition();

  const onPickTicket = useCallback((row: TicketPickerRow) => {
    setSelected(row);
    setResult(null);
    setError(null);
  }, []);

  const onPreview = useCallback(() => {
    if (!selected || isPreviewing) return;
    setError(null);
    startPreviewing(async () => {
      try {
        const out = await previewScoreWithDraft({
          ticketId: selected.id,
          scorecard: {
            id: scorecard.id,
            name: scorecard.name,
            version: scorecard.version,
            categories: scorecard.categories,
          },
        });
        setResult(out);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview failed");
      }
    });
  }, [isPreviewing, scorecard, selected]);

  // Map for rendering category names — the provider returns category ids;
  // names live on the draft scorecard.
  const categoryMeta = useMemo(() => {
    return new Map(scorecard.categories.map((c) => [c.id, c]));
  }, [scorecard.categories]);

  return (
    <section>
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-muted-foreground" />
        <h2 className="text-base font-medium text-foreground">
          Test on a conversation
        </h2>
      </div>
      <p className="mt-1 text-base text-muted-foreground">
        Mock-score a scored ticket against your unsaved rubric. Confidence
        builder — nothing is persisted.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <TicketPicker selected={selected} onPick={onPickTicket} />
        <Button
          type="button"
          onClick={onPreview}
          disabled={!selected || isPreviewing}
          variant="secondary"
          className="cursor-pointer"
        >
          {isPreviewing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Scoring…
            </>
          ) : (
            "Preview score"
          )}
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-lighter px-4 py-3 text-base text-red-dark">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex items-baseline justify-between">
            <div className="min-w-0">
              <div className="truncate text-base font-medium text-foreground">
                {result.ticket.subject}
              </div>
              {result.ticket.customerName && (
                <div className="text-base text-muted-foreground">
                  {result.ticket.customerName}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tabular-nums text-foreground">
                {result.output.overallScore}
              </div>
              <div className="text-sm text-muted-foreground">overall</div>
            </div>
          </div>

          {result.output.autoFailTriggered && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-lighter px-3 py-1 text-sm text-red-dark">
              Auto-fail triggered — overall floored
            </div>
          )}

          <p className="mt-3 text-base text-muted-foreground">
            {result.output.aiReasoningSummary}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {result.output.categoryScores.map((cs) => {
              const meta = categoryMeta.get(cs.categoryId);
              if (!meta) return null;
              return (
                <div
                  key={cs.categoryId}
                  className="flex items-start justify-between gap-3 rounded-lg bg-background/60 px-3 py-2 ring-1 ring-foreground/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-base text-foreground">{meta.name}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {cs.aiReasoning}
                    </div>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <div className="text-base font-medium text-foreground">
                      {formatScore(cs.aiScore, meta.scaleType)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {scaleSummary(meta.scaleType)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function formatScore(score: number, scale: ScorecardScaleType): string {
  if (scale === "binary") return score === 1 ? "Pass" : "Fail";
  return String(score);
}

function scaleSummary(scale: ScorecardScaleType): string {
  if (scale === "likert_5") return "of 5";
  if (scale === "binary") return "pass/fail";
  return "of 2";
}

function TicketPicker({
  selected,
  onPick,
}: {
  selected: TicketPickerRow | null;
  onPick: (row: TicketPickerRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<TicketPickerRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced fetch. Mirrors the search-palette pattern: ~150ms cancellation
  // window so typing fast doesn't fan out a stack of in-flight requests.
  // Loading is flipped inside the timeout so we don't setState in the effect
  // body (which would trigger a cascading render per react-hooks lint).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await searchScoredTickets(query);
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-base hover:bg-muted/50"
          aria-label="Pick a ticket to preview"
        >
          <span className="truncate text-left">
            {selected ? (
              <>
                <span className="text-foreground">{selected.subject}</span>
                {selected.customerName && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {selected.customerName}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                Pick a scored ticket…
              </span>
            )}
          </span>
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(420px,90vw)] p-0"
      >
        <div className="border-b border-foreground/10 p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by subject or customer…"
            className="h-8"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {loading && rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {query.length === 0
                ? "No scored tickets yet"
                : "No matches"}
            </div>
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  onPick(row);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent/40"
              >
                <span className="truncate text-base text-foreground">
                  {row.subject}
                </span>
                {row.customerName && (
                  <span className="truncate text-sm text-muted-foreground">
                    {row.customerName}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
