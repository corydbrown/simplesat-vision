import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { teamMembers } from "@/db/schema";
import { colorFromName, dicebearUrl } from "@/lib/color-from-name";
import { prefixedId } from "@/lib/ids";

/** Known AI provider/platform values. The DB column (`team_members.provider`)
 *  is free text — new vendors must never gate on a migration — so this union
 *  is the *recognized* set today, not the canonical truth. `unknown` is the
 *  explicit fallback returned by `resolveProviderFromAuthor` when no clause
 *  matches; the lazy-create path still seeds a row so messages get attributed,
 *  but the workspace admin needs to rename + re-tag it later. */
export type AiProvider =
  | "intercom_fin"
  | "decagon"
  | "sierra"
  | "openai_assistant"
  | "anthropic_custom"
  | "unknown";

/** Default display name + DiceBear avatar style per provider. `bottts` for
 *  every AI agent (humans get `fun-emoji`) — gives the team_members list a
 *  visual "this is a bot" cue. The two BYO-config providers
 *  (`anthropic_custom`, `openai_assistant`) ship with placeholder names that
 *  read as obvious "rename me" markers in the UI. */
export const DEFAULT_AI_TEAM_MEMBER_DEFAULTS: Record<
  AiProvider,
  { name: string; dicebearStyle: "bottts" }
> = {
  intercom_fin: { name: "Fin", dicebearStyle: "bottts" },
  decagon: { name: "Decagon agent", dicebearStyle: "bottts" },
  sierra: { name: "Sierra agent", dicebearStyle: "bottts" },
  anthropic_custom: {
    name: "Anthropic agent (rename me)",
    dicebearStyle: "bottts",
  },
  openai_assistant: {
    name: "OpenAI agent (rename me)",
    dicebearStyle: "bottts",
  },
  unknown: { name: "AI agent", dicebearStyle: "bottts" },
};

/** Inspect a raw author payload (e.g. an Intercom `conversation.parts[N].author`
 *  object) and return the AI provider. Pure — no DB, no network. Detection
 *  lives here, not at the ingest call site, so adding a vendor or refining a
 *  discriminator is one place to change. Today only Intercom Fin is detected;
 *  Decagon / Sierra / OpenAI / Anthropic-custom land as `unknown` until we
 *  see live payloads from those integrations. */
export function resolveProviderFromAuthor(authorRaw: unknown): AiProvider {
  if (typeof authorRaw !== "object" || authorRaw === null) return "unknown";
  const a = authorRaw as Record<string, unknown>;

  // Intercom: `author.type === "bot"` is the only natively-emitted bot type
  // and (today) always means Fin — Intercom does not ship a second native bot.
  // If they ever do, add a second clause keyed on `author.id` / `author.name`.
  if (a.type === "bot") return "intercom_fin";

  return "unknown";
}

/** Pure. Decide AI attribution for an *ingested* message: returns the provider a
 *  bot turn should be attributed to, or `null` when the turn is not a bot (human
 *  agent / customer / system). Drives `team_member_id` resolution in
 *  `upsertMessage`.
 *
 *  Why `intercom_fin` is hardcoded rather than running `resolveProviderFromAuthor`:
 *  by the time a message reaches ingest, n8n has already coerced Intercom's
 *  `author` object into `authorRole + authorSubtype` (see `messageIngestSchema`),
 *  so the raw payload `resolveProviderFromAuthor` needs is gone. Both workspaces
 *  with bot traffic today (Simplesat + Pronto) run Intercom Fin, so this is
 *  correct now. Follow-up: plumb the raw `author` through ingest so this can
 *  call `resolveProviderFromAuthor` for multi-provider attribution. */
export function resolveBotProviderForMessage(input: {
  authorRole: string;
  authorSubtype?: string | null;
}): AiProvider | null {
  if (input.authorRole === "agent" && input.authorSubtype === "bot") {
    return "intercom_fin";
  }
  return null;
}

/** Idempotent. Returns the `team_member.id` for `(workspaceId, kind='ai_agent',
 *  provider)`. Creates the row with default name + DiceBear bottts avatar on
 *  first call; subsequent calls return the existing id without touching the
 *  row. Safe to call from the Phase 1c ingest hook on every bot message —
 *  first message creates, the rest no-op. */
export async function lazyCreateAiTeamMember(
  workspaceId: string,
  provider: AiProvider,
  opts?: { model?: string; deployedAt?: Date | null },
): Promise<string> {
  const existing = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, workspaceId),
        eq(teamMembers.kind, "ai_agent"),
        eq(teamMembers.provider, provider),
      ),
    )
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const defaults = DEFAULT_AI_TEAM_MEMBER_DEFAULTS[provider];
  const id = prefixedId("tm");
  await db.insert(teamMembers).values({
    id,
    workspaceId,
    name: defaults.name,
    // Synthetic placeholder — `team_members.email` is NOT NULL and some
    // resolution fallbacks key off email. Stable per-provider so re-seeding
    // never violates a uniqueness expectation downstream.
    email: `${provider}@ai.simplesat.local`,
    role: "AI agent",
    team: "AI",
    kind: "ai_agent",
    provider,
    model: opts?.model ?? null,
    deployedAt: opts?.deployedAt ?? null,
    avatarColor: colorFromName(defaults.name),
    avatarUrl: dicebearUrl(defaults.name, defaults.dicebearStyle),
    avatarSource: "helpdesk",
  });
  return id;
}
