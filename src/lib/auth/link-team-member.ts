import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { teamMembers, userWorkspaces } from "@/db/schema";

/** Accepts either the top-level `db` client or a drizzle transaction handle.
 *  Matches the pattern used in [src/app/callback/route.ts](src/app/callback/route.ts). */
type DbClient =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Opportunistically link a user's workspace membership to their agent
 *  identity in that workspace via email match.
 *
 *  Reads the first `team_members` row in `workspaceId` whose `email` matches
 *  `email` (case-sensitive — emails in `users` and `team_members` are stored
 *  as the source system gave them; helpdesk sources lowercase). If a match
 *  exists, updates `user_workspaces.team_member_id` for the (user, workspace)
 *  pair. **Only writes when the column is currently null** — never overwrites
 *  an existing link, since the override flow (admin / user picks a different
 *  team_member) is a follow-up that will set this explicitly.
 *
 *  Returns the linked `team_members.id` (or null when no match / already
 *  linked). Never throws on missing data — auth callers wrap in try/catch
 *  with console.error so a link failure doesn't break sign-in. */
export async function linkTeamMemberByEmail(
  client: DbClient,
  userId: string,
  workspaceId: string,
  email: string,
): Promise<string | null> {
  const [match] = await client
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, workspaceId),
        eq(teamMembers.email, email),
      ),
    )
    .limit(1);
  if (!match) return null;

  // Only fill the slot when it's currently empty — preserves any explicit
  // override a future admin UI might write.
  await client
    .update(userWorkspaces)
    .set({ teamMemberId: match.id })
    .where(
      and(
        eq(userWorkspaces.userId, userId),
        eq(userWorkspaces.workspaceId, workspaceId),
        isNull(userWorkspaces.teamMemberId),
      ),
    );

  return match.id;
}

/** Convenience wrapper around the top-level `db` client. */
export async function linkTeamMemberByEmailDb(
  userId: string,
  workspaceId: string,
  email: string,
): Promise<string | null> {
  return linkTeamMemberByEmail(db, userId, workspaceId, email);
}
