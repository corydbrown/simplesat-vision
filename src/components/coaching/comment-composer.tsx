"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CommentComposerHandle = {
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
};

/**
 * Composer for a new coaching comment. Enter submits, Shift+Enter inserts
 * a newline. No keyboard-hint badge inside the submit button (V1 spec).
 *
 * `onUpArrowEmpty` fires when the user presses Up Arrow inside an empty
 * textarea — that's the "edit last own comment" affordance.
 */
export function CommentComposer({
  ref,
  initialValue = "",
  placeholder = "Add a coaching note…",
  onSubmit,
  onUpArrowEmpty,
  onFocus,
  onBlur,
  autoFocus = false,
  rows = 2,
}: {
  ref?: React.Ref<CommentComposerHandle>;
  initialValue?: string;
  placeholder?: string;
  onSubmit: (body: string) => void;
  onUpArrowEmpty?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  rows?: number;
}) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const focusedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
    isFocused: () => focusedRef.current,
  }));

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <div>
      <Textarea
        ref={textareaRef}
        value={value}
        rows={rows}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          focusedRef.current = true;
          onFocus?.();
        }}
        onBlur={() => {
          focusedRef.current = false;
          onBlur?.();
        }}
        placeholder={placeholder}
        className="min-h-16 resize-none text-base"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
            return;
          }
          if (e.key === "ArrowUp" && value === "" && onUpArrowEmpty) {
            e.preventDefault();
            onUpArrowEmpty();
            return;
          }
        }}
      />
      <div className="mt-1.5 flex items-center justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
