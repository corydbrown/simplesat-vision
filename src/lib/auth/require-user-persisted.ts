import "server-only";

import { db } from "@/db/client";
import { users, type User } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { DEV_AUTH_BYPASS, DEV_USER } from "@/lib/dev-auth";

/** Returns the signed-in user, throwing when unauthenticated, and ensures
 *  the user has a row in the local `users` table.
 *
 *  The dev-bypass user (`usr_dev_bypass`) is deliberately not seeded — see
 *  [src/lib/dev-auth.ts](src/lib/dev-auth.ts) — so any write that FKs to
 *  `users.id` would orphan in bypass mode without an insert-on-write. This
 *  helper does that insert idempotently. In production the WorkOS `/callback`
 *  flow has already inserted the row, so this is a no-op there.
 *
 *  Use anywhere a server action writes a row whose FK target is `users.id`
 *  (qa_comments, qa_reactions, evaluation_feedback, evaluations.edited_by). */
export async function requireUserPersisted(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (DEV_AUTH_BYPASS && user.id === DEV_USER.id) {
    await db
      .insert(users)
      .values({
        id: DEV_USER.id,
        workosId: DEV_USER.workosId,
        email: DEV_USER.email,
        name: DEV_USER.name,
        avatarUrl: DEV_USER.avatarUrl,
        createdAt: DEV_USER.createdAt,
      })
      .onConflictDoNothing({ target: users.id });
  }

  return user;
}
