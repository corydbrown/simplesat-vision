"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import type { EvaluationVersionRow } from "@/db/queries/evaluations";

type Size = "sm" | "md";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-1.5 py-0.5 text-sm",
  md: "px-2.5 py-1 text-base",
};

/** Version pill + popover for the coaching detail header.
 *
 *  Renders nothing when there's only one evaluation for the ticket (the most
 *  common case until users start re-scoring with edited scorecards).
 *
 *  When multiple versions exist, the pill shows `v{n} · latest` for the newest
 *  one and `v{n}` for older ones. Clicking opens a popover that lists every
 *  evaluation for the ticket; selecting one navigates to its coaching page. */
export function VersionPicker({
  currentEvaluationId,
  versions,
  size = "sm",
}: {
  currentEvaluationId: string;
  versions: EvaluationVersionRow[];
  size?: Size;
}) {
  const [open, setOpen] = useState(false);

  if (versions.length <= 1) return null;

  const current = versions.find((v) => v.id === currentEvaluationId);
  if (!current) return null;

  const latest = versions[0];
  const isLatest = current.id === latest.id;

  const pillClass = isLatest
    ? "bg-primary/10 text-primary hover:bg-primary/15"
    : "bg-accent/40 text-foreground hover:bg-accent";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group inline-flex cursor-pointer items-center gap-1 rounded-full font-medium tabular-nums ${SIZE_CLASSES[size]} ${pillClass}`}
        >
          <span>v{current.scorecardVersion}</span>
          {isLatest && (
            <span className="font-normal opacity-80">· latest</span>
          )}
          <ChevronDown
            size={12}
            className="opacity-60 transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 p-0">
        {!isLatest && (
          <Link
            href={`/coaching/${latest.id}`}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-2 border-b bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15"
          >
            <span>Newer version available — v{latest.scorecardVersion}</span>
            <ArrowUpRight size={14} />
          </Link>
        )}
        <ul className="max-h-80 overflow-y-auto py-1">
          {versions.map((v) => {
            const isCurrent = v.id === currentEvaluationId;
            const isLatestRow = v.id === latest.id;
            return (
              <li key={v.id}>
                <Link
                  href={`/coaching/${v.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent ${
                    isCurrent ? "bg-accent/60" : ""
                  }`}
                >
                  <span className="font-medium tabular-nums text-foreground">
                    v{v.scorecardVersion}
                    {isLatestRow && (
                      <span className="ml-1 font-normal text-primary">
                        · latest
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {formatDate(v.scoredAt)}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="tabular-nums text-foreground">
                    {v.overallScore}/100
                  </span>
                  {isCurrent && (
                    <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                      <Check size={12} />
                      Viewing
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
