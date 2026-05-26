import { handleAuth } from "@workos-inc/authkit-nextjs";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { prefixedId } from "@/lib/ids";

/** WorkOS redirects here after the user completes the AuthKit flow.
 *  `handleAuth` validates the code, establishes the session cookie, runs
 *  the `onSuccess` upsert below, then redirects to the `returnTo` path
 *  carried through state (defaulting to `/tickets` if none was set). */
export const GET = handleAuth({
  returnPathname: "/tickets",
  onSuccess: async ({ user: workosUser }) => {
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
      return;
    }

    await db.insert(users).values({
      id: prefixedId("usr"),
      workosId: workosUser.id,
      email: workosUser.email,
      name: displayName,
      avatarUrl,
      createdAt: now,
      lastSeenAt: now,
    });
  },
});
