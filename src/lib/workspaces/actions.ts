"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireWorkspace, setActiveWorkspaceId } from "@/lib/workspace";
import { getCurrentUser } from "@/lib/auth";
import { getLogoProvider, normalizeDomain } from "@/lib/logos";
import { resolveTeamMember } from "@/lib/ingest/resolve-team-member";
import type { TeamMemberResolutionRule } from "@/db/schema";

/** Verifies the caller is signed in AND is an admin of the active workspace.
 *  Returns the workspaceId on success; an error result otherwise. Used by the
 *  workspace-settings mutations to keep their authz check identical. */
async function requireWorkspaceAdmin(): Promise<
  | { ok: true; workspaceId: string }
  | { ok: false; error: string }
> {
  const [workspaceId, user] = await Promise.all([
    requireWorkspace(),
    getCurrentUser(),
  ]);
  if (!user) return { ok: false, error: "Not authenticated" };

  const [membership] = await db
    .select({ role: schema.userWorkspaces.role })
    .from(schema.userWorkspaces)
    .where(
      and(
        eq(schema.userWorkspaces.userId, user.id),
        eq(schema.userWorkspaces.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return { ok: false, error: "Admin access required" };
  }
  return { ok: true, workspaceId };
}

const RenameWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
});

export type RenameWorkspaceResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export async function renameWorkspace(
  _prevState: RenameWorkspaceResult | null,
  formData: FormData,
): Promise<RenameWorkspaceResult> {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = RenameWorkspaceSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  await db
    .update(schema.workspaces)
    .set({ name: parsed.data.name })
    .where(eq(schema.workspaces.id, auth.workspaceId));

  revalidatePath("/settings/workspace");
  revalidatePath("/", "layout");

  return { ok: true, name: parsed.data.name };
}

export type FetchWorkspaceLogoResult =
  | { ok: true; logoUrl: string; domain: string }
  | { ok: false; error: string };

const FetchLogoSchema = z.object({
  domain: z.string().trim().min(1, "Domain is required").max(253, "Domain too long"),
});

/** Resolves a logo for `domain` via the configured [[LogoProvider]] and
 *  persists both the normalized domain and the resulting URL onto the active
 *  workspace. The domain comes in user-typed (may include scheme, www., path)
 *  — the provider normalizes; we persist the normalized form so the UI
 *  shows a clean value next time the page loads. */
export async function fetchWorkspaceLogo(
  _prevState: FetchWorkspaceLogoResult | null,
  formData: FormData,
): Promise<FetchWorkspaceLogoResult> {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = FetchLogoSchema.safeParse({ domain: formData.get("domain") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid domain" };
  }

  const normalized = normalizeDomain(parsed.data.domain);
  if (!normalized) {
    return {
      ok: false,
      error: `"${parsed.data.domain}" doesn't look like a domain (e.g. simplesat.io).`,
    };
  }

  const provider = getLogoProvider();
  const result = await provider.resolveLogo(normalized);
  if (!result.ok) {
    // Persist the domain even on a failed fetch so the user doesn't lose
    // what they typed — next attempt re-uses it.
    await db
      .update(schema.workspaces)
      .set({ domain: normalized })
      .where(eq(schema.workspaces.id, auth.workspaceId));
    revalidatePath("/settings/workspace");
    return { ok: false, error: result.message };
  }

  await db
    .update(schema.workspaces)
    .set({ domain: normalized, logoUrl: result.logoUrl })
    .where(eq(schema.workspaces.id, auth.workspaceId));

  revalidatePath("/settings/workspace");
  revalidatePath("/", "layout");

  return { ok: true, logoUrl: result.logoUrl, domain: normalized };
}

export type ClearWorkspaceLogoResult =
  | { ok: true }
  | { ok: false; error: string };

/** Clears `logoUrl` (keeps `domain` so a re-fetch is one click). */
export async function clearWorkspaceLogo(): Promise<ClearWorkspaceLogoResult> {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  await db
    .update(schema.workspaces)
    .set({ logoUrl: null })
    .where(eq(schema.workspaces.id, auth.workspaceId));

  revalidatePath("/settings/workspace");
  revalidatePath("/", "layout");

  return { ok: true };
}

const SetActiveWorkspaceSchema = z.object({
  workspaceId: z.string().min(1),
});

/** Switches the signed-in user's active workspace.
 *
 *  Guards:
 *  - User must be signed in.
 *  - The target workspace must be in the user's `user_workspaces` rows. We
 *    NEVER trust the client to send a workspace the user actually belongs to
 *    — the switcher dropdown only lists valid options, but a crafted request
 *    could try to escape that. If membership check fails we throw rather
 *    than silently no-op so the failure surfaces.
 *
 *  After writing the cookie we `revalidatePath("/", "layout")` so cached
 *  server-component output (sidebar nav, list pages) re-renders against the
 *  new workspace. Then redirect to `/tickets` — the canonical landing page
 *  after a switch — which also dismisses any open drawer/filter state from
 *  the prior workspace that wouldn't make sense in the new one. */
export async function setActiveWorkspace(workspaceId: string): Promise<never> {
  const { workspaceId: id } = SetActiveWorkspaceSchema.parse({ workspaceId });

  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const [membership] = await db
    .select({ workspaceId: schema.userWorkspaces.workspaceId })
    .from(schema.userWorkspaces)
    .where(
      and(
        eq(schema.userWorkspaces.userId, user.id),
        eq(schema.userWorkspaces.workspaceId, id),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new Error("User is not a member of this workspace");
  }

  await setActiveWorkspaceId(id);
  revalidatePath("/", "layout");
  redirect("/tickets");
}

const SetResolutionRuleSchema = z.object({
  rule: z.enum(["assignee", "solver", "most_time_logged", "opened_by"]),
});

export type SetResolutionRuleResult =
  | { ok: true; rule: TeamMemberResolutionRule; reresolved: number }
  | { ok: false; error: string };

/** Persists the workspace's team-member resolution rule AND re-runs the
 *  resolver against every imported ticket's stored `sourceAgents` bag so the
 *  credited `teamMemberId` reflects the new rule immediately. This is the
 *  load-bearing UX promise of the setting: flip the rule, the whole app
 *  re-credits.
 *
 *  Synchronous in-request by design (per Cory): fine at prototype scale. If
 *  this grows past ~10k tickets per workspace, lift into a background job —
 *  the function itself stays the same. */
export async function setTeamMemberResolutionRule(
  _prevState: SetResolutionRuleResult | null,
  formData: FormData,
): Promise<SetResolutionRuleResult> {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = SetResolutionRuleSchema.safeParse({
    rule: formData.get("rule"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid rule" };
  }
  const { rule } = parsed.data;

  await db
    .update(schema.workspaces)
    .set({ teamMemberResolutionRule: rule })
    .where(eq(schema.workspaces.id, auth.workspaceId));

  const reresolved = await reresolveAllTickets(auth.workspaceId, rule);

  revalidatePath("/settings/workspace");
  revalidatePath("/", "layout");

  return { ok: true, rule, reresolved };
}

/** Walks every ticket in the workspace and updates `teamMemberId` to whatever
 *  the new rule resolves against the stored `sourceAgents`. Returns the count
 *  of tickets actually touched.
 *
 *  Strategy: bucket tickets by their next `teamMemberId` and issue one UPDATE
 *  per bucket — turns 50k row updates into ~N+1 statements (one per distinct
 *  member + one for null). Chunked to stay well under SQLite's parameter cap.
 *
 *  Soft-resolve semantics from ingest: if the new rule references a role that
 *  isn't synced (or `sourceAgents` doesn't carry that key — common for Intercom
 *  + `most_time_logged`), `teamMemberId` becomes null. The stored sourceAgents
 *  bag is lossless, so flipping the rule back restores the prior credit. */
async function reresolveAllTickets(
  workspaceId: string,
  rule: TeamMemberResolutionRule,
): Promise<number> {
  const [memberRows, ticketRows] = await Promise.all([
    db
      .select({
        id: schema.teamMembers.id,
        externalId: schema.teamMembers.externalId,
      })
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.workspaceId, workspaceId)),
    db
      .select({
        id: schema.tickets.id,
        sourceAgents: schema.tickets.sourceAgents,
        teamMemberId: schema.tickets.teamMemberId,
      })
      .from(schema.tickets)
      .where(eq(schema.tickets.workspaceId, workspaceId)),
  ]);

  const idByExternalId = new Map<string, string>();
  for (const m of memberRows) {
    if (m.externalId) idByExternalId.set(m.externalId, m.id);
  }

  // Bucket ticket-ids by their next teamMemberId (null bucket keyed as "").
  const buckets = new Map<string, string[]>();
  for (const t of ticketRows) {
    const externalId = resolveTeamMember(t.sourceAgents, rule);
    const next = externalId ? idByExternalId.get(externalId) ?? null : null;
    if (next === t.teamMemberId) continue;
    const key = next ?? "";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(t.id);
  }

  // libsql/sqlite caps at ~32k bind variables; 500 per chunk is safely under.
  const CHUNK = 500;
  let changed = 0;
  for (const [key, ids] of buckets) {
    const nextTeamMemberId = key === "" ? null : key;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await db
        .update(schema.tickets)
        .set({ teamMemberId: nextTeamMemberId })
        .where(inArray(schema.tickets.id, chunk));
      changed += chunk.length;
    }
  }
  return changed;
}
