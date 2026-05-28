"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireWorkspace, setActiveWorkspaceId } from "@/lib/workspace";
import { getCurrentUser } from "@/lib/auth";
import { getLogoProvider, normalizeDomain } from "@/lib/logos";

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
