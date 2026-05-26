import "server-only";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users, type User } from "@/db/schema";

/** Canonical "who's logged in" accessor for server code. Reads the WorkOS
 *  session from the encrypted cookie, then looks up the matching `users`
 *  row by `workos_id`. Returns `null` when the request is unauthenticated
 *  or when the WorkOS user has no local row yet (which should only happen
 *  if `/callback` failed mid-upsert). All future code — sidebar pill,
 *  audit fields, workspace scoping — should read through this helper. */
export async function getCurrentUser(): Promise<User | null> {
  const { user: workosUser } = await withAuth();
  if (!workosUser) return null;

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.workosId, workosUser.id))
    .limit(1);

  return row ?? null;
}

/** Restrict a user-supplied redirect target to a same-origin pathname.
 *  Accepts only strings that start with a single `/` and no scheme; this
 *  blocks `//evil.com/path` (protocol-relative open redirect) and any
 *  absolute URL. Returns `null` when the input is unsafe so callers can
 *  fall back to a default. */
export function safeReturnPath(input: string | null | undefined): string | null {
  if (!input) return null;
  if (!input.startsWith("/")) return null;
  if (input.startsWith("//")) return null;
  if (input.startsWith("/\\")) return null;
  return input;
}
