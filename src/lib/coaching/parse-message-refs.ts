export type ReasoningSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; number: number };

/** Matches "Message N" where N is a positive integer, with word boundaries on
 *  both sides so "Messages 3" / "Message 12-15" / "Message 3a" behave
 *  correctly. The LLM is prompted to emit refs in this exact shape — see
 *  src/lib/qa/scoring/prompt.ts. */
const MESSAGE_REF_RE = /\bMessage (\d+)\b/g;

export function parseMessageRefs(text: string): ReasoningSegment[] {
  const segments: ReasoningSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MESSAGE_REF_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: "text", text: text.slice(lastIndex, start) });
    }
    segments.push({ kind: "mention", number: Number(match[1]) });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", text: text.slice(lastIndex) });
  }
  return segments;
}
