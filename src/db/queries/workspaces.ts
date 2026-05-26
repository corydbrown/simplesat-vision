import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "../client";
import { requireWorkspace } from "@/lib/workspace";
import { getCurrentUser } from "@/lib/auth";

export type WorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  integrationType: "intercom" | "zendesk" | "mock";
  createdAt: number;
  createdByName: string | null;
  createdByEmail: string | null;
};

export type WorkspaceMember = {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  joinedAt: number;
};

/** Returns the active workspace with creator details. Creator is a separate
 *  lookup so seed workspaces with null `created_by` still return a row. */
export async function getActiveWorkspaceDetails(): Promise<WorkspaceDetails | null> {
  const workspaceId = await requireWorkspace();

  const [row] = await db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      slug: schema.workspaces.slug,
      logoUrl: schema.workspaces.logoUrl,
      integrationType: schema.workspaces.integrationType,
      createdAt: schema.workspaces.createdAt,
      createdBy: schema.workspaces.createdBy,
    })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1);

  if (!row) return null;

  let createdByName: string | null = null;
  let createdByEmail: string | null = null;

  if (row.createdBy) {
    const [creator] = await db
      .select({ name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, row.createdBy))
      .limit(1);
    createdByName = creator?.name ?? null;
    createdByEmail = creator?.email ?? null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl,
    integrationType: row.integrationType,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
    createdByName,
    createdByEmail,
  };
}

/** Returns all members of the active workspace, ordered by join date. */
export async function listWorkspaceMembers(): Promise<WorkspaceMember[]> {
  const workspaceId = await requireWorkspace();

  const rows = await db
    .select({
      userId: schema.userWorkspaces.userId,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      role: schema.userWorkspaces.role,
      joinedAt: schema.userWorkspaces.createdAt,
    })
    .from(schema.userWorkspaces)
    .innerJoin(schema.users, eq(schema.users.id, schema.userWorkspaces.userId))
    .where(eq(schema.userWorkspaces.workspaceId, workspaceId))
    .orderBy(asc(schema.userWorkspaces.createdAt));

  return rows.map((r) => ({
    ...r,
    joinedAt: r.joinedAt instanceof Date ? r.joinedAt.getTime() : r.joinedAt,
  }));
}

/** Returns the current user's role in the active workspace, or null. */
export async function getCurrentUserRole(): Promise<"admin" | "member" | null> {
  const [workspaceId, user] = await Promise.all([
    requireWorkspace(),
    getCurrentUser(),
  ]);
  if (!user) return null;

  const [row] = await db
    .select({ role: schema.userWorkspaces.role })
    .from(schema.userWorkspaces)
    .where(
      and(
        eq(schema.userWorkspaces.userId, user.id),
        eq(schema.userWorkspaces.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  return row?.role ?? null;
}
