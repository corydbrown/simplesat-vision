"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireWorkspace, setActiveWorkspaceId } from "@/lib/workspace";
import { getCurrentUser } from "@/lib/auth";

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
  const [workspaceId, user] = await Promise.all([
    requireWorkspace(),
    getCurrentUser(),
  ]);

  if (!user) return { ok: false, error: "Not authenticated" };

  // Verify caller is admin for this workspace
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
    return { ok: false, error: "Admin access required to rename workspace" };
  }

  const parsed = RenameWorkspaceSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  await db
    .update(schema.workspaces)
    .set({ name: parsed.data.name })
    .where(eq(schema.workspaces.id, workspaceId));

  revalidatePath("/settings/workspace");

  return { ok: true, name: parsed.data.name };
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
