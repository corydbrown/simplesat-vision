"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseMessageRefs } from "@/lib/coaching/parse-message-refs";

/**
 * Inline mention — Notion/Linear-style reference that flows in prose.
 * Accent text + tiny leading glyph + faint hover tint. Inherits font-size
 * from the surrounding paragraph so it reads as part of the sentence.
 *
 * Generic on purpose: future @-mentions, #channel refs, etc. all render
 * through this same primitive. Uses span+role to be safe to embed inside
 * an outer <button> (nested <button> would be invalid HTML).
 */
export function InlineMention({
  label,
  onClick,
  glyph,
  className,
}: {
  label: string;
  onClick: () => void;
  glyph?: React.ReactNode;
  className?: string;
}) {
  function activate(e: React.SyntheticEvent) {
    e.stopPropagation();
    onClick();
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate(e);
        }
      }}
      className={cn(
        "inline-flex cursor-pointer items-baseline gap-0.5 -mx-0.5 rounded-sm px-1 font-medium not-italic text-blue-dark transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {glyph && <span className="self-center opacity-70">{glyph}</span>}
      <span>{label}</span>
    </span>
  );
}

/**
 * Renders a reasoning string with "Message N" tokens turned into clickable
 * `InlineMention`s. The LLM is prompted to emit references in this shape
 * (see src/lib/qa/scoring/prompt.ts). N is the 1-based position of the
 * message in the conversation, matching the prompt's numbering.
 *
 * If N is out of range (no id in `messageIdByNumber`), the ref is rendered
 * as plain text rather than a fake-clickable mention.
 */
export function ReasoningWithMentions({
  text,
  messageIdByNumber,
  onJump,
}: {
  text: string;
  messageIdByNumber: Map<number, string>;
  onJump: (messageId: string) => void;
}) {
  const segments = parseMessageRefs(text);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "text") return <span key={i}>{seg.text}</span>;
        const id = messageIdByNumber.get(seg.number);
        if (id == null) return <span key={i}>Message {seg.number}</span>;
        return (
          <InlineMention
            key={i}
            label={`Message ${seg.number}`}
            glyph={<MessageSquare className="size-3" />}
            onClick={() => onJump(id)}
          />
        );
      })}
    </>
  );
}
