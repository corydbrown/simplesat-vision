import "server-only";

import { NextResponse } from "next/server";

import { resolveApiKey } from "@/lib/ingest/api-keys";

export type AuthOk = {
  ok: true;
  workspaceId: string;
  /** Identity of the resolved API key — the rate-limit bucket key. */
  keyId: string;
  /** HMAC signing secret, or null when signing is not enforced for this key. */
  signingSecret: string | null;
};
export type AuthErr = { ok: false; response: NextResponse };
export type AuthResult = AuthOk | AuthErr;

function unauthorized(message: string): AuthErr {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status: 401 }),
  };
}

/** Authenticate an ingest request by its `Authorization: Bearer <key>` header.
 *  On success the resolved workspace id IS the write scope — there is no cookie
 *  / `requireWorkspace()` involved (the key is the workspace identity). On
 *  failure returns a ready-to-return 401 `NextResponse` so route handlers stay
 *  a one-liner:
 *
 *    const auth = await authenticateApiKey(request);
 *    if (!auth.ok) return auth.response;
 *    // auth.workspaceId is the scope for every write below
 */
export async function authenticateApiKey(
  request: Request,
): Promise<AuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return unauthorized("Missing or malformed Authorization: Bearer header");
  }

  const resolved = await resolveApiKey(match[1].trim());
  if (!resolved) {
    return unauthorized("Invalid or revoked API key");
  }

  return {
    ok: true,
    workspaceId: resolved.workspaceId,
    keyId: resolved.id,
    signingSecret: resolved.signingSecret,
  };
}
