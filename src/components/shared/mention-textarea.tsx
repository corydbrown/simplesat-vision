"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Textarea } from "@/components/ui/textarea";
import {
  applyMention,
  filterMentions,
  findActiveTrigger,
  type ActiveTrigger,
} from "@/lib/mentions/mention-query";
import type { MentionItem, MentionSource } from "@/lib/mentions/types";
import { cn } from "@/lib/utils";

export type MentionTextareaHandle = {
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
};

type DropdownPos = { left: number; top: number; width: number; flip: boolean };

const MAX_DROPDOWN_H = 256;

/**
 * Controlled textarea with `@`/`/`-style mention autocomplete. Generic by
 * design: it knows nothing about messages — hand it `sources` and it detects
 * the trigger char, filters items, and inserts the chosen item's `token` at the
 * caret. Adding people-mentions or `/`-commands is a new source object, not a
 * code change here.
 *
 * Keyboard ownership: when the dropdown is open, ↑/↓/Enter/Tab/Esc are consumed
 * (navigate/select/close) and NOT forwarded. Otherwise every key passes through
 * to `onKeyDown`, so a parent's Enter-to-submit keeps working.
 *
 * The dropdown is portaled to <body> and positioned against the textarea's
 * bounding rect — the composer lives inside an `overflow-hidden` panel, so an
 * inline absolute menu would clip.
 */
export function MentionTextarea({
  ref,
  value,
  onChange,
  sources,
  placeholder,
  rows = 2,
  className,
  disabled,
  maxLength,
  autoFocus = false,
  onKeyDown,
  onFocus,
  onBlur,
}: {
  ref?: React.Ref<MentionTextareaHandle>;
  value: string;
  onChange: (value: string) => void;
  sources: MentionSource[];
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const focusedRef = useRef(false);
  const [active, setActive] = useState<ActiveTrigger | null>(null);
  // Mirror of `active` for event handlers to read the latest start without a
  // stale closure (handlers may read refs; render may not).
  const activeRef = useRef<ActiveTrigger | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  // Esc dismisses the menu for the *current* trigger run (keyed by its start
  // index); a new trigger run reopens it. State (not a ref) so render is pure.
  const [dismissed, setDismissed] = useState<number | null>(null);
  // Caret to restore after a programmatic value change (token insert).
  const pendingCaret = useRef<number | null>(null);

  const triggers = sources.map((s) => s.trigger);
  const source = active ? sources.find((s) => s.trigger === active.trigger) : null;
  const matches: MentionItem[] =
    active && source ? filterMentions(source.items, active.query) : [];
  const open =
    active != null && matches.length > 0 && active.start !== dismissed;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    blur: () => taRef.current?.blur(),
    isFocused: () => focusedRef.current,
  }));

  // Restore caret after a programmatic value change (token insert).
  useLayoutEffect(() => {
    if (pendingCaret.current == null) return;
    const ta = taRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  });

  const recomputePos = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const r = ta.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const flip = below < MAX_DROPDOWN_H && r.top > below;
    setPos({
      left: r.left,
      top: flip ? r.top : r.bottom,
      width: Math.max(r.width, 240),
      flip,
    });
  }, []);

  // Re-detect the active trigger from the live caret position.
  const sync = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const next = findActiveTrigger(ta.value, ta.selectionStart ?? 0, triggers);
    if (next?.start !== activeRef.current?.start) {
      setDismissed(null);
      setHighlight(0);
    }
    activeRef.current = next;
    setActive(next);
  }, [triggers]);

  useLayoutEffect(() => {
    if (open) recomputePos();
  }, [open, active?.query, recomputePos]);

  useEffect(() => {
    if (!open) return;
    const handler = () => recomputePos();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, recomputePos]);

  function select(item: MentionItem) {
    const ta = taRef.current;
    if (!ta || !active) return;
    const caret = ta.selectionStart ?? ta.value.length;
    const res = applyMention(value, active, caret, item.token);
    pendingCaret.current = res.caret;
    setDismissed(null);
    activeRef.current = null;
    setActive(null);
    onChange(res.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        select(matches[highlight] ?? matches[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (active) setDismissed(active.start);
        return;
      }
    }
    onKeyDown?.(e);
  }

  const safeHighlight = Math.min(highlight, matches.length - 1);

  return (
    <>
      <Textarea
        ref={taRef}
        value={value}
        rows={rows}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          // The DOM value + caret are already updated on the event target, so
          // sync() reads the fresh state right after we lift it to the parent.
          onChange(e.target.value);
          sync();
        }}
        onKeyUp={(e) => {
          // Arrow/click caret moves (no value change) still re-detect trigger.
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) sync();
        }}
        onClick={sync}
        onFocus={() => {
          focusedRef.current = true;
          onFocus?.();
        }}
        onBlur={() => {
          focusedRef.current = false;
          // Delay so a mouse-click on a dropdown row lands before close.
          setTimeout(() => {
            if (!focusedRef.current) setActive(null);
          }, 120);
          onBlur?.();
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            role="listbox"
            className="fixed z-50 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            style={{
              left: pos.left,
              width: pos.width,
              maxHeight: MAX_DROPDOWN_H,
              ...(pos.flip
                ? { bottom: window.innerHeight - pos.top + 4 }
                : { top: pos.top + 4 }),
            }}
            // Keep the textarea focused; rows select on mousedown.
            onMouseDown={(e) => e.preventDefault()}
          >
            {matches.map((item, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={i === safeHighlight}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(item)}
                className={cn(
                  "flex cursor-pointer flex-col gap-0.5 rounded-md px-2 py-1.5",
                  i === safeHighlight && "bg-accent",
                )}
              >
                <span className="text-base font-medium text-foreground">
                  {item.label}
                </span>
                {item.description && (
                  <span className="truncate text-sm text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
