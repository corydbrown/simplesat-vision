"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Wraps a plain property value (string / number / id / date) with a
 *  Notion-style hover-to-copy affordance. The copy button reveals on hover of
 *  the enclosing property row — the parent supplies a `group/proprow` so the
 *  button can react to row hover, not just value hover. Clicking copies the
 *  value's rendered text to the clipboard; the icon flips to a check for ~1.5s.
 *
 *  We read the copy text from the DOM (`textContent`) rather than threading a
 *  raw accessor through every Property descriptor — that keeps this a single
 *  composable affordance instead of N edits across the property registries.
 *  For text-kind values the rendered text *is* the raw value (email, id, name,
 *  formatted date/number). Empty values render a faint "—" placeholder; those
 *  get no copy button. Interactive pills are excluded upstream (they carry
 *  their own affordances) — this only wraps non-component property values. */
export function CopyableValue({ children }: { children: React.ReactNode }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const [hasValue, setHasValue] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  // After each render, gate the button on whether there's real text to copy.
  // Intentionally deps-less: children can change as a drawer reuses the row,
  // and there's no stable value to key on. Safe from loops — state only writes
  // when the boolean actually flips.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const text = valueRef.current?.textContent?.trim() ?? "";
    const next = text.length > 0 && text !== "—";
    setHasValue((prev) => (prev === next ? prev : next));
  });

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    const text = valueRef.current?.textContent?.trim() ?? "";
    if (!text || text === "—") return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can reject without a user gesture / permissions — no-op
    }
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <span ref={valueRef} className="min-w-0 break-words">
        {children}
      </span>
      {hasValue && (
        <Tooltip open={copied || undefined}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={copied ? "Copied" : "Copy value"}
              onClick={copy}
              className={cn(
                "shrink-0 cursor-pointer self-center text-muted-foreground opacity-0 transition-opacity",
                "group-hover/proprow:opacity-100 focus-visible:opacity-100",
                copied && "text-green-dark opacity-100",
              )}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {copied ? "Copied" : "Copy"}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
