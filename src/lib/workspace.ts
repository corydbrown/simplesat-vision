import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { userWorkspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { DEV_AUTH_BYPASS, DEV_DEFAULT_WORKSPACE_ID } from "@/lib/dev-auth";

export { DEMO_WORKSPACE_ID } from "@/lib/workspace-id";

const COOKIE_NAME = "simplesat_active_workspace";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function getSigningSecret(): string {
  const secret = process.env.WORKOS_COOKIE_PASSWORD;
  if (!secret) {
    throw new Error(
      "WORKOS_COOKIE_PASSWORD is required to sign the active-workspace cookie",
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSigningSecret()).update(value).digest("hex");
}

function verify(value: string, signature: string): boolean {
  const expected = sign(value);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function encode(workspaceId: string): string {
  return `${workspaceId}.${sign(workspaceId)}`;
}

function decode(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  return verify(value, signature) ? value : null;
}

/** Returns the active workspace id for the current request, or null. Resolves
 *  in order: signed cookie → first `user_workspaces` row by `created_at ASC`
 *  for the signed-in user. Does NOT throw — callers that require a workspace
 *  use `requireWorkspace()`. */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const fromCookie = decode((await cookies()).get(COOKIE_NAME)?.value);
  if (fromCookie) return fromCookie;

  // Dev bypass: the synthetic user has no membership rows, so fall back to a
  // default workspace (the switcher's cookie above still takes precedence).
  if (DEV_AUTH_BYPASS) return DEV_DEFAULT_WORKSPACE_ID;

  const user = await getCurrentUser();
  if (!user) return null;

  const [row] = await db
    .select({ workspaceId: userWorkspaces.workspaceId })
    .from(userWorkspaces)
    .where(eq(userWorkspaces.userId, user.id))
    .orderBy(asc(userWorkspaces.createdAt))
    .limit(1);

  return row?.workspaceId ?? null;
}

/** Returns the active workspace id, or throws. Use in server code that
 *  cannot meaningfully proceed without a workspace (queries, mutations).
 *  Reaches the throw only when a signed-in user has zero membership rows,
 *  which indicates a broken `/callback` upsert. */
export async function requireWorkspace(): Promise<string> {
  const id = await getActiveWorkspaceId();
  if (!id) {
    throw new Error(
      "No active workspace — user has no user_workspaces membership rows",
    );
  }
  return id;
}

/** Persist the active workspace selection in a signed cookie. Called by the
 *  Phase 3 switcher UI; unused in Phase 1. */
export async function setActiveWorkspaceId(workspaceId: string): Promise<void> {
  (await cookies()).set({
    name: COOKIE_NAME,
    value: encode(workspaceId),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}
