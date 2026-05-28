import { handleAuth } from "@workos-inc/authkit-nextjs";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { userWorkspaces, users, workspaces } from "@/db/schema";
import { prefixedId } from "@/lib/ids";

/** WorkOS redirects here after the user completes the AuthKit flow.
 *  `handleAuth` validates the code, establishes the session cookie, runs
 *  the `onSuccess` upsert below, then redirects to the `returnTo` path
 *  carried through state (defaulting to `/tickets` if none was set). */
export const GET = handleAuth({
  returnPathname: "/tickets",
  onSuccess: async (data) => {
    const workosUser = data.user;
    const workosOrgId = data.organizationId ?? null;
    const now = new Date();
    const displayName = workosUser.firstName
      ? [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ")
      : null;
    const avatarUrl = workosUser.profilePictureUrl ?? null;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.workosId, workosUser.id))
      .limit(1);

    if (existing) {
      await db
        .update(users)
        .set({
          name: displayName ?? existing.name,
          avatarUrl: avatarUrl ?? existing.avatarUrl,
          lastSeenAt: now,
        })
        .where(eq(users.id, existing.id));

      // Reconcile membership against the session's WorkOS org. If the
      // session carries an org and a workspace is linked to it, ensure
      // the user has a `user_workspaces` row for that workspace — no-op
      // when they already do. Returning users whose WorkOS membership
      // grows are picked up incrementally without an explicit invite UI.
      await ensureMembershipForOrg(existing.id, workosOrgId, now);
      return;
    }

    // First-login provisioning. Insert the user row + grant memberships.
    //
    // When the WorkOS session carries an org AND that org is bound to a
    // workspace via `workspaces.workos_organization_id`, the new user
    // only gets that one workspace — the production model.
    //
    // When the org binding is absent (legacy/dev: no orgs configured, or
    // the user signed in without selecting an org), we keep the Phase 1
    // shortcut and grant `admin` on every seeded workspace. That keeps
    // Cory from locking himself out while the WorkOS mapping is still
    // being filled in.
    const newUserId = prefixedId("usr");
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: newUserId,
        workosId: workosUser.id,
        email: workosUser.email,
        name: displayName,
        avatarUrl,
        createdAt: now,
        lastSeenAt: now,
      });

      const grants = await resolveInitialGrants(tx, workosOrgId);
      if (grants.length > 0) {
        await tx.insert(userWorkspaces).values(
          grants.map((w) => ({
            id: prefixedId("uwk"),
            userId: newUserId,
            workspaceId: w.id,
            role: "admin" as const,
            createdAt: now,
          })),
        );
      }
    });
  },
});

/** Returns the workspaces a brand-new user should be granted on first
 *  login. When the session carries a WorkOS org bound to a workspace,
 *  just that one. Otherwise every workspace (legacy fallback). */
async function resolveInitialGrants(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workosOrgId: string | null,
): Promise<{ id: string }[]> {
  if (workosOrgId) {
    const bound = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.workosOrganizationId, workosOrgId))
      .limit(1);
    if (bound.length > 0) return bound;
    // Org session but no workspace bound to it. Fall through to legacy
    // behavior rather than provisioning an empty user.
  }
  return tx.select({ id: workspaces.id }).from(workspaces);
}

/** Idempotent membership insert for the workspace bound to the session's
 *  WorkOS org. Returning users whose WorkOS org binding lights up after
 *  their initial login are picked up here without a separate invite flow.
 *  No-op when the session has no org, no workspace is bound, or the user
 *  already has the membership row. */
async function ensureMembershipForOrg(
  userId: string,
  workosOrgId: string | null,
  now: Date,
): Promise<void> {
  if (!workosOrgId) return;
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.workosOrganizationId, workosOrgId))
    .limit(1);
  if (!workspace) return;

  const [existingMembership] = await db
    .select({ id: userWorkspaces.id })
    .from(userWorkspaces)
    .where(
      and(
        eq(userWorkspaces.userId, userId),
        eq(userWorkspaces.workspaceId, workspace.id),
      ),
    )
    .limit(1);
  if (existingMembership) return;

  await db.insert(userWorkspaces).values({
    id: prefixedId("uwk"),
    userId,
    workspaceId: workspace.id,
    role: "admin",
    createdAt: now,
  });
}
