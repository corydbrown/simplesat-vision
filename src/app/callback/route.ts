import { handleAuth } from "@workos-inc/authkit-nextjs";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { userWorkspaces, users, workspaces } from "@/db/schema";
import { linkTeamMemberByEmail } from "@/lib/auth/link-team-member";
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

      // Opportunistic team_member auto-link on every sign-in (SVP-211).
      // Idempotent: skips rows that are already linked, populates rows
      // that are still null whenever an email match exists in the
      // workspace. Wrapped so a link failure can't break the callback.
      await safeLinkAllMemberships(existing.id, workosUser.email);
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

        // Auto-link the new user's agent identity in every granted
        // workspace where a team_member email matches (SVP-211). Within
        // the same tx so the link lands atomically with the membership.
        for (const w of grants) {
          try {
            await linkTeamMemberByEmail(tx, newUserId, w.id, workosUser.email);
          } catch (err) {
            console.error("[callback] linkTeamMemberByEmail failed", {
              userId: newUserId,
              workspaceId: w.id,
              err,
            });
          }
        }
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

/** Run the team_member auto-link across every workspace the user has access
 *  to. Idempotent: `linkTeamMemberByEmail` only writes when the slot is null,
 *  so re-running on every sign-in is a no-op for already-linked memberships
 *  and a backfill for newly-synced team_members. Wrapped per-workspace so a
 *  single failure doesn't skip the rest, and never throws — the callback
 *  must never fail because of an opportunistic side-effect. */
async function safeLinkAllMemberships(
  userId: string,
  email: string,
): Promise<void> {
  let memberships: { workspaceId: string }[];
  try {
    memberships = await db
      .select({ workspaceId: userWorkspaces.workspaceId })
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId));
  } catch (err) {
    console.error("[callback] safeLinkAllMemberships read failed", {
      userId,
      err,
    });
    return;
  }

  for (const m of memberships) {
    try {
      await linkTeamMemberByEmail(db, userId, m.workspaceId, email);
    } catch (err) {
      console.error("[callback] linkTeamMemberByEmail failed", {
        userId,
        workspaceId: m.workspaceId,
        err,
      });
    }
  }
}
