"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireWorkspace } from "@/lib/workspace";
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
