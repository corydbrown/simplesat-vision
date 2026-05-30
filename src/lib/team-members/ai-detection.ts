import "server-only";

import { and, eq, or, sql } from "drizzle-orm";

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

/** SVP-281. SQL `LIKE` patterns that identify a helpdesk-synced AI agent row
 *  that predates the `kind` discriminator added in [Phase 1a /
 *  drizzle/0033_svp268_team_member_kind.sql]. The Phase 1a migration
 *  backfilled every existing row to `kind='human'`, so an Intercom Fin admin
 *  synced before that point sits in the DB as `kind='human'` and the original
 *  `lazyCreateAiTeamMember` (only matching `kind='ai_agent'`) created a
 *  duplicate. The upgrade path uses these patterns to find the existing row
 *  and flip its kind instead.
 *
 *  Only providers with stable, vendor-emitted identifier shapes ship a
 *  pattern. Name-substring matching is intentionally OUT — false-positive
 *  risk on legitimate humans named "Bot Smith" / "AI Anderson" / etc.
 *
 *  Add a new entry only after seeing live data from that provider confirming
 *  the shape. */
const VENDOR_MATCH_PATTERNS: Partial<
  Record<AiProvider, { email?: string; externalId?: string }>
> = {
  intercom_fin: {
    // Intercom synthesizes `operator+<workspaceId>@intercom.io` for Fin's
    // admin record. n8n may route that string to either `email` or
    // `external_id` (or both) depending on how the helpdesk-sync flow is
    // wired — match either column.
    email: "operator+%@intercom.io",
    externalId: "operator+%@intercom.io",
  },
  // decagon / sierra / openai_assistant / anthropic_custom: no stable
  // vendor-emitted identifier observed yet. Add when we see live data.
};

/** Pure. Does a candidate team_member row match the vendor's known
 *  identifier shape? Mirrors the SQL `LIKE` semantics the upgrade query uses
 *  (single-`%` wildcard, single-`_` wildcard, otherwise literal). Testing
 *  this helper IS coverage of the DB filter. */
export function rowMatchesVendor(
  row: { email: string | null; externalId: string | null },
  patterns: { email?: string; externalId?: string } | undefined,
): boolean {
  if (!patterns) return false;
  if (patterns.email && row.email && sqlLike(row.email, patterns.email)) {
    return true;
  }
  if (
    patterns.externalId &&
    row.externalId &&
    sqlLike(row.externalId, patterns.externalId)
  ) {
    return true;
  }
  return false;
}

/** Pure. SQL `LIKE` matcher with `%` (any sequence) and `_` (any single char)
 *  wildcards. Case-insensitive — the columns we check (`email`, `external_id`)
 *  are not case-sensitive in practice. */
function sqlLike(input: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = escaped.replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${regex}$`, "i").test(input);
}

/** Pure. Choose the AI team_member's display name from the brief's three-step
 *  fallback chain:
 *
 *  1. `callerName` — set when the ingest payload carries the bot's brand
 *     directly. Today no caller passes this; the API seam is preserved for
 *     when raw author payloads are plumbed through ingest.
 *  2. `upgradeFromName` — when upgrading an existing `kind='human'` row to
 *     `kind='ai_agent'`, keep its name. That row was helpdesk-synced and
 *     already carries the workspace's customer-facing brand (e.g. "Sim" for
 *     Simplesat's Fin deployment).
 *  3. `providerDefault` — vendor-default name from
 *     `DEFAULT_AI_TEAM_MEMBER_DEFAULTS` (e.g. "Fin", "Decagon agent").
 *
 *  Whitespace-only `callerName` is treated as absent so a trimmed-empty
 *  payload field falls through cleanly. */
export function pickAiTeamMemberName(opts: {
  callerName?: string;
  upgradeFromName?: string;
  providerDefault: string;
}): string {
  const trimmed = opts.callerName?.trim();
  if (trimmed) return trimmed;
  const upgrade = opts.upgradeFromName?.trim();
  if (upgrade) return upgrade;
  return opts.providerDefault;
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

/** Idempotent. Returns the `team_member.id` for the workspace's AI agent of a
 *  given provider. Three-step match-or-upgrade-or-insert (see SVP-281):
 *
 *  1. **Fast path.** Existing `kind='ai_agent' AND provider=?` row → return id.
 *  2. **Upgrade path.** If the provider has a `VENDOR_MATCH_PATTERNS` entry
 *     and a `kind='human'` row matches the vendor's identifier shape, flip
 *     its kind to `ai_agent` (and stamp the provider / `role` / `team`). The
 *     existing `name`, `email`, `externalId`, `avatarUrl` are preserved — the
 *     row was helpdesk-synced and already carries the workspace's
 *     customer-facing brand. This path closes the duplicate-Fin bug.
 *  3. **Insert path.** No match → create a fresh row with the vendor default
 *     name + DiceBear bottts avatar (or `opts.name` if the caller passes one).
 *
 *  Safe to call from the Phase 1c ingest hook on every bot message — first
 *  message creates or upgrades, the rest hit the fast path. */
export async function lazyCreateAiTeamMember(
  workspaceId: string,
  provider: AiProvider,
  opts?: { model?: string; deployedAt?: Date | null; name?: string },
): Promise<string> {
  // Step 1 — fast path.
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

  // Step 2 — upgrade path. Find a helpdesk-synced row matching the vendor's
  // known identifier shape (regardless of current `kind`) and flip it to
  // `ai_agent`. The SQL filter is the same `LIKE` semantics as
  // `rowMatchesVendor`, which is what the unit tests cover.
  const patterns = VENDOR_MATCH_PATTERNS[provider];
  if (patterns) {
    const orClauses = [
      patterns.email
        ? sql`${teamMembers.email} LIKE ${patterns.email}`
        : null,
      patterns.externalId
        ? sql`${teamMembers.externalId} LIKE ${patterns.externalId}`
        : null,
    ].filter((c): c is NonNullable<typeof c> => c !== null);
    if (orClauses.length > 0) {
      const candidate = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.workspaceId, workspaceId), or(...orClauses)))
        .limit(1);
      if (candidate.length > 0) {
        const id = candidate[0].id;
        await db
          .update(teamMembers)
          .set({
            kind: "ai_agent",
            provider,
            role: "AI agent",
            team: "AI",
            model: opts?.model ?? null,
            deployedAt: opts?.deployedAt ?? null,
            updatedAt: new Date(),
          })
          .where(eq(teamMembers.id, id));
        return id;
      }
    }
  }

  // Step 3 — insert path.
  const defaults = DEFAULT_AI_TEAM_MEMBER_DEFAULTS[provider];
  const name = pickAiTeamMemberName({
    callerName: opts?.name,
    providerDefault: defaults.name,
  });
  const id = prefixedId("tm");
  await db.insert(teamMembers).values({
    id,
    workspaceId,
    name,
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
    avatarColor: colorFromName(name),
    avatarUrl: dicebearUrl(name, defaults.dicebearStyle),
    avatarSource: "helpdesk",
  });
  return id;
}
