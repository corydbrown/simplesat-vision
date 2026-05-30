import type { MentionItem } from "./types";

export type ActiveTrigger = {
  /** The trigger char that's currently open, e.g. "@". */
  trigger: string;
  /** Text typed after the trigger up to the caret (the filter query). */
  query: string;
  /** Index of the trigger char in the value — the start of the range that
   *  gets replaced when an item is selected. */
  start: number;
};

const isWhitespace = (ch: string) => /\s/.test(ch);

/**
 * Given the textarea value and caret offset, decide whether the caret is
 * inside an open mention trigger, and if so which one + what's being typed.
 *
 * A trigger is "open" when, scanning left from the caret, we reach a trigger
 * char before hitting any whitespace, AND that trigger char sits at the start
 * of the text or is preceded by whitespace. The second rule keeps "@" inside
 * an email ("foo@bar") or "/" inside a path ("a/b") from opening a menu.
 *
 * The query is whatever lies between the trigger and the caret. It is
 * whitespace-free by construction (we stop at the first space), so a multi-word
 * label like "Message 3" is *matched* by typing "3" or "mes", not retyped.
 */
export function findActiveTrigger(
  value: string,
  caret: number,
  triggers: readonly string[],
): ActiveTrigger | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i];
    if (isWhitespace(ch)) return null;
    if (triggers.includes(ch)) {
      const before = i > 0 ? value[i - 1] : "";
      if (i === 0 || isWhitespace(before)) {
        return { trigger: ch, query: value.slice(i + 1, caret), start: i };
      }
      return null;
    }
  }
  return null;
}

/**
 * Filter + rank mention items against a query. Empty query returns every item
 * (bare "@" shows the full list). Otherwise case-insensitive substring match
 * on label first, keywords second, ranked: label-prefix > label-substring >
 * keyword-substring. Ties keep the source order (stable).
 */
export function filterMentions(
  items: readonly MentionItem[],
  query: string,
): MentionItem[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [...items];

  const scored: { item: MentionItem; score: number; order: number }[] = [];
  items.forEach((item, order) => {
    const label = item.label.toLowerCase();
    const keywords = item.keywords?.toLowerCase() ?? "";
    let score = 0;
    if (label.startsWith(q)) score = 3;
    else if (label.includes(q)) score = 2;
    else if (keywords.includes(q)) score = 1;
    if (score > 0) scored.push({ item, score, order });
  });

  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((s) => s.item);
}

/**
 * Replace the active trigger's range (`@query`) with `token` + a trailing
 * space, returning the new value and where the caret should land. Pure so the
 * insert math is unit-testable independent of the DOM.
 */
export function applyMention(
  value: string,
  active: ActiveTrigger,
  caret: number,
  token: string,
): { value: string; caret: number } {
  const insert = `${token} `;
  const next = value.slice(0, active.start) + insert + value.slice(caret);
  return { value: next, caret: active.start + insert.length };
}
