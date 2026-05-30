import type { CoachingMessageView } from "@/db/queries/coaching";
import type { MentionItem, MentionSource } from "./types";

/** Author role → short label shown in the dropdown description. */
const ROLE_LABEL: Record<CoachingMessageView["authorRole"], string> = {
  customer: "customer",
  agent: "agent",
  system: "system",
};

function snippet(body: string, max = 60): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Build the `@` mention source from a ticket's messages. The token is the bare
 * "Message N" string the read-side regex (parse-message-refs.ts) matches, so an
 * inserted ref renders identically to an AI-generated one. N is the 1-based
 * position in the conversation — the same numbering the scoring prompt and
 * `messageIdByNumber` use.
 *
 * Pure: same messages in → same source out. Glyph is intentionally omitted
 * (lib files stay JSX-free); the label "Message N" is self-explanatory.
 */
export function buildMessageMentionSource(
  messages: readonly CoachingMessageView[],
): MentionSource {
  const items: MentionItem[] = messages.map((msg, i) => {
    const n = i + 1;
    const who = msg.authorName?.trim() || ROLE_LABEL[msg.authorRole];
    return {
      id: msg.id,
      token: `Message ${n}`,
      label: `Message ${n}`,
      description: `${who} · "${snippet(msg.body)}"`,
      keywords: `${who} ${msg.body}`,
    };
  });

  return {
    trigger: "@",
    items,
    emptyLabel: "No messages match",
  };
}
