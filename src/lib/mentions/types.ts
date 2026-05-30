/**
 * Generic mention-autocomplete model. The composer (`MentionTextarea`) is
 * source-agnostic: it knows how to detect a trigger char, filter items, and
 * insert a token at the caret. What gets mentioned is entirely described by
 * the `MentionSource`s you hand it.
 *
 * Today the only source is the current ticket's messages (`@` → "Message N",
 * see message-source.ts). Adding people-mentions (`@alice`) or `/`-commands
 * later is a config flip — build a different `MentionSource` and add it to the
 * array. No change to the composer itself.
 */

/** A single thing that can be inserted by selecting it from the dropdown. */
export type MentionItem = {
  /** Stable React key + dedupe key. */
  id: string;
  /** Literal text inserted into the textarea at the caret, e.g. "Message 3".
   *  Must match whatever the read-side renderer parses back into a mention
   *  (for messages that's the bare "Message N" string the regex in
   *  parse-message-refs.ts matches). */
  token: string;
  /** Primary text shown in the dropdown row. */
  label: string;
  /** Secondary muted text shown under/after the label (author + snippet). */
  description?: string;
  /** Extra text folded into search matching beyond `label` (e.g. message
   *  body), so typing a word from the message finds it. */
  keywords?: string;
};

/** One trigger char + the items it offers. The composer can take several
 *  (e.g. `@` for entities, `/` for commands) and routes by the typed char. */
export type MentionSource = {
  /** Single character that opens this source's dropdown, e.g. "@" or "/". */
  trigger: string;
  items: MentionItem[];
  /** Optional Lucide-style glyph rendered before each row's label. */
  glyph?: React.ReactNode;
  /** Shown when the trigger is open but nothing matches the query. */
  emptyLabel?: string;
};
