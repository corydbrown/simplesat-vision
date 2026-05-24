/**
 * Curated emoji set for QA-evaluation reactions (messages, comments, and
 * activity events). Locked at 6 to keep the per-target reaction row visually
 * scannable — same set used by the existing QA message-reaction UI.
 *
 * Enforced at the provider layer (see `MockCommentProvider.addReaction`).
 * The DB column is plain text so the schema doesn't need a migration when
 * product wants to tweak the set.
 */

export const COACHING_REACTIONS = [
  "\u{1F440}", // 👀
  "\u{1F44D}", // 👍
  "❤️", // ❤️
  "\u{1F525}", // 🔥
  "✨", // ✨
  "\u{1F62C}", // 😬
] as const;

export type CoachingReaction = (typeof COACHING_REACTIONS)[number];

export function isCoachingReaction(value: string): value is CoachingReaction {
  return (COACHING_REACTIONS as readonly string[]).includes(value);
}
