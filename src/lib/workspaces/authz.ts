import "server-only";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCurrentUser } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";

export type AdminAuthResult =
  | { ok: true; workspaceId: string; userId: string; workosUserId: string }
  | { ok: false; error: string };

/** Verifies the caller is signed in AND is an admin of the active workspace.
 *  Returns the workspaceId + local userId + workos userId on success; an
 *  error result otherwise. Shared by every admin-gated server action
 *  (workspace settings, user management). */
export async function requireWorkspaceAdmin(): Promise<AdminAuthResult> {
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
  return {
    ok: true,
    workspaceId,
    userId: user.id,
    workosUserId: user.workosId,
  };
}
