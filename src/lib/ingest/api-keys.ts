import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { workspaceApiKeys, workspaces } from "@/db/schema";
import { prefixedId } from "@/lib/ids";

/** Plaintext keys are `svk_<workspace-slug-fragment>_<random>`. The
 *  `svk_<fragment>` portion is the display-safe prefix; the random tail is the
 *  secret. 24 random bytes → 32 base64url chars → 192 bits of entropy. */
const KEY_PREFIX_SCHEME = "svk";
const RANDOM_BYTES = 24;

/** SHA-256 hex of the full plaintext key. Fast + indexable; safe because the
 *  key is a 192-bit random token, not a low-entropy password (see the
 *  `workspace_api_keys` schema comment for the bcrypt/argon2 rationale). The
 *  same function hashes both at create-time and on every request lookup, so it
 *  is the single source of truth for the hashing scheme. */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** First display-safe segment, e.g. `svk_bloom`. Derives a short, stable
 *  fragment from the workspace slug (or id) so a future settings UI can show
 *  which workspace a key belongs to without revealing the secret. */
function keyPrefixFor(slugOrId: string): string {
  const fragment = slugOrId
    .replace(/^wks_/, "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toLowerCase();
  return `${KEY_PREFIX_SCHEME}_${fragment}`;
}

export type CreatedApiKey = {
  id: string;
  /** The full plaintext key. Returned exactly once — never recoverable. */
  key: string;
  keyPrefix: string;
};

/** Mint a new API key for a workspace. Persists only the hash; returns the
 *  plaintext once for the caller to surface (CLI prints it, future UI shows a
 *  copy-once dialog). Throws if the workspace doesn't exist. */
export async function createWorkspaceApiKey(
  workspaceId: string,
  label?: string,
): Promise<CreatedApiKey> {
  const [workspace] = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    throw new Error(`No workspace with id "${workspaceId}"`);
  }

  const prefix = keyPrefixFor(workspace.slug || workspace.id);
  const secret = randomBytes(RANDOM_BYTES).toString("base64url");
  const key = `${prefix}_${secret}`;
  const id = prefixedId("wak");

  await db.insert(workspaceApiKeys).values({
    id,
    workspaceId,
    keyHash: hashApiKey(key),
    keyPrefix: prefix,
    label: label ?? null,
  });

  return { id, key, keyPrefix: prefix };
}

/** Generate and store a fresh HMAC signing secret for an existing key,
 *  enabling (or rotating) signing on it. Returns the plaintext secret once —
 *  the caller shares it with the signing client (e.g. n8n). 32 random bytes →
 *  base64url. Throws if the key id is unknown. Until this is called a key has
 *  `signing_secret = null` and its requests are accepted unsigned, which is how
 *  the live caller keeps working until it's coordinated onto signing. */
export async function rotateApiKeySigningSecret(
  keyId: string,
): Promise<{ keyId: string; signingSecret: string }> {
  const signingSecret = randomBytes(32).toString("base64url");
  const result = await db
    .update(workspaceApiKeys)
    .set({ signingSecret })
    .where(eq(workspaceApiKeys.id, keyId))
    .returning({ id: workspaceApiKeys.id });

  if (result.length === 0) {
    throw new Error(`No API key with id "${keyId}"`);
  }

  return { keyId, signingSecret };
}

export type ResolvedApiKey = {
  id: string;
  workspaceId: string;
  /** HMAC signing secret, or null when signing is not enforced for this key. */
  signingSecret: string | null;
};

/** Resolve a plaintext key to its workspace, or null if unknown/revoked.
 *  Indexed O(1) lookup by hash. Bumps `last_used_at` best-effort — awaited (so
 *  it doesn't race the request's own write transaction and trip SQLITE_BUSY on
 *  the local file DB) but wrapped so a timestamp failure never rejects an
 *  otherwise-valid key. */
export async function resolveApiKey(
  plaintext: string,
): Promise<ResolvedApiKey | null> {
  const keyHash = hashApiKey(plaintext);
  const [row] = await db
    .select({
      id: workspaceApiKeys.id,
      workspaceId: workspaceApiKeys.workspaceId,
      signingSecret: workspaceApiKeys.signingSecret,
    })
    .from(workspaceApiKeys)
    .where(
      and(
        eq(workspaceApiKeys.keyHash, keyHash),
        isNull(workspaceApiKeys.revokedAt),
      ),
    )
    .limit(1);

  if (!row) return null;

  try {
    await db
      .update(workspaceApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(workspaceApiKeys.id, row.id));
  } catch {
    // Non-critical: a failed last_used_at bump must not reject a valid key.
  }

  return row;
}
