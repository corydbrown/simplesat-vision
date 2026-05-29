import "server-only";

import { WorkOS } from "@workos-inc/node";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireWorkspace } from "@/lib/workspace";
import type { WorkspaceRole } from "@/lib/users/validate";

export type OrgMember = {
  membershipId: string;
  /** WorkOS user id (e.g. `user_…`). Source of truth for any WorkOS write. */
  workosUserId: string;
  /** Local `users.id`. Null when the user has never signed in (membership
   *  was created directly via `createOrganizationMembership`; `/callback`
   *  hasn't provisioned a local row yet). */
  localUserId: string | null;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  /** WorkOS membership status. `active` users can sign in. `pending` =
   *  invitation accepted but membership not yet activated. `inactive` =
   *  deactivated. */
  status: "active" | "pending" | "inactive";
  role: WorkspaceRole;
  joinedAt: number;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: number;
  createdAt: number;
};

let _workos: WorkOS | null = null;
function workos(): WorkOS {
  if (_workos) return _workos;
  const key = process.env.WORKOS_API_KEY;
  if (!key) throw new Error("WORKOS_API_KEY is not set");
  _workos = new WorkOS(key);
  return _workos;
}

/** Resolves the active workspace's WorkOS organization id. Throws if the
 *  workspace isn't linked to a WorkOS org (no `workos_organization_id`). */
export async function getWorkosOrgId(): Promise<string> {
  const workspaceId = await requireWorkspace();
  const [row] = await db
    .select({ orgId: schema.workspaces.workosOrganizationId })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1);
  if (!row?.orgId) {
    throw new Error("Workspace is not linked to a WorkOS organization");
  }
  return row.orgId;
}

function normalizeRole(slug: string | null | undefined): WorkspaceRole {
  return slug === "admin" ? "admin" : "member";
}

function toMillis(input: unknown): number {
  if (typeof input === "number") return input;
  if (typeof input === "string") {
    const t = Date.parse(input);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/** Lists active and pending members of the active workspace's WorkOS org. The
 *  membership list is the source of truth (not local `user_workspaces`), so
 *  users invited but not yet signed-in show up here even before `/callback`
 *  provisions a local row. */
export async function listOrgMembers(): Promise<OrgMember[]> {
  const orgId = await getWorkosOrgId();
  const w = workos();

  const [membershipPage, userPage] = await Promise.all([
    w.userManagement.listOrganizationMemberships({
      organizationId: orgId,
      limit: 100,
    }),
    w.userManagement.listUsers({ organizationId: orgId, limit: 100 }),
  ]);

  const usersById = new Map<string, (typeof userPage.data)[number]>();
  for (const u of userPage.data) usersById.set(u.id, u);

  const workosUserIds = membershipPage.data.map((m) => m.userId);
  const localRows = workosUserIds.length
    ? await db
        .select({ id: schema.users.id, workosId: schema.users.workosId })
        .from(schema.users)
        .where(inArray(schema.users.workosId, workosUserIds))
    : [];
  const localIdByWorkosId = new Map(localRows.map((r) => [r.workosId, r.id]));

  const out: OrgMember[] = [];
  for (const m of membershipPage.data) {
    const u = usersById.get(m.userId);
    if (!u) continue;
    out.push({
      membershipId: m.id,
      workosUserId: m.userId,
      localUserId: localIdByWorkosId.get(m.userId) ?? null,
      email: u.email,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
      avatarUrl: (u as { profilePictureUrl?: string | null }).profilePictureUrl ?? null,
      status: m.status as "active" | "pending" | "inactive",
      role: normalizeRole(m.role?.slug),
      joinedAt: toMillis(m.createdAt),
    });
  }
  out.sort((a, b) => a.joinedAt - b.joinedAt);
  return out;
}

/** Lists invitations for the active workspace's WorkOS org that are still
 *  outstanding (state === "pending"). Accepted / expired / revoked are
 *  filtered out — they're noise on a management surface. */
export async function listPendingInvitations(): Promise<PendingInvitation[]> {
  const orgId = await getWorkosOrgId();
  const w = workos();

  const page = await w.userManagement.listInvitations({
    organizationId: orgId,
    limit: 100,
  });

  return page.data
    .filter((inv) => inv.state === "pending")
    .map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: normalizeRole(inv.roleSlug),
      expiresAt: toMillis(inv.expiresAt),
      createdAt: toMillis(inv.createdAt),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Finds a WorkOS user by email. Returns null if no account exists yet. */
export async function findUserByEmail(
  email: string,
): Promise<{ id: string } | null> {
  const page = await workos().userManagement.listUsers({ email, limit: 1 });
  const user = page.data[0];
  return user ? { id: user.id } : null;
}

export async function sendInvitation(args: {
  email: string;
  role: WorkspaceRole;
}): Promise<void> {
  const orgId = await getWorkosOrgId();
  await workos().userManagement.sendInvitation({
    email: args.email,
    organizationId: orgId,
    roleSlug: args.role,
  });
}

export async function createMembership(args: {
  userId: string;
  role: WorkspaceRole;
}): Promise<void> {
  const orgId = await getWorkosOrgId();
  await workos().userManagement.createOrganizationMembership({
    organizationId: orgId,
    userId: args.userId,
    roleSlug: args.role,
  });
}

/** Returns the membership row for (userId, active workspace's org), or null. */
export async function findMembership(
  userId: string,
): Promise<{ id: string; role: WorkspaceRole } | null> {
  const orgId = await getWorkosOrgId();
  const page = await workos().userManagement.listOrganizationMemberships({
    userId,
    organizationId: orgId,
    limit: 1,
  });
  const m = page.data[0];
  if (!m) return null;
  return { id: m.id, role: normalizeRole(m.role?.slug) };
}

export async function updateMembershipRole(args: {
  membershipId: string;
  role: WorkspaceRole;
}): Promise<void> {
  await workos().userManagement.updateOrganizationMembership(args.membershipId, {
    roleSlug: args.role,
  });
}

export async function deleteMembership(membershipId: string): Promise<void> {
  await workos().userManagement.deleteOrganizationMembership(membershipId);
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await workos().userManagement.revokeInvitation(invitationId);
}

export async function resendInvitation(invitationId: string): Promise<void> {
  await workos().userManagement.resendInvitation(invitationId);
}
