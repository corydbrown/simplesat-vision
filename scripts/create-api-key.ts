/**
 * Mint a workspace API key for the ingest API and print it ONCE.
 *
 * Usage (Phase 1 — no UI yet; UI lands in Phase 4 at /settings/api-keys):
 *
 *   set -a && source .env.local && set +a   # so it targets the right DB
 *   npx tsx --conditions=react-server scripts/create-api-key.ts [workspaceId] [label]
 *
 *   # defaults to the Bloom Beauty demo workspace if no id is given:
 *   npx tsx --conditions=react-server scripts/create-api-key.ts
 *
 * The plaintext key is shown only here — it is never recoverable (we store
 * only its SHA-256 hash). Copy it into n8n's Authorization header as
 * `Bearer <key>`.
 */
import { createWorkspaceApiKey } from "@/lib/ingest/api-keys";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace-id";

async function main() {
  const workspaceId = process.argv[2] || DEMO_WORKSPACE_ID;
  const label = process.argv[3];

  const { id, key, keyPrefix } = await createWorkspaceApiKey(
    workspaceId,
    label,
  );

  console.log("");
  console.log("  API key created — copy it now, it will not be shown again:");
  console.log("");
  console.log(`    ${key}`);
  console.log("");
  console.log(`  id:        ${id}`);
  console.log(`  prefix:    ${keyPrefix}`);
  console.log(`  workspace: ${workspaceId}`);
  if (label) console.log(`  label:     ${label}`);
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
