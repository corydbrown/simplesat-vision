/**
 * Enable (or rotate) HMAC request signing on an existing ingest API key, and
 * print the signing secret ONCE.
 *
 *   set -a && source .env.local && set +a   # so it targets the right DB
 *   npx tsx --conditions=react-server scripts/enable-signing.ts <apiKeyId>
 *
 * The `<apiKeyId>` is the `id` printed when the key was minted
 * (`scripts/create-api-key.ts`), e.g. `wak_...`.
 *
 * Signing is opt-in: a key with no signing secret accepts unsigned requests
 * (this is what keeps the live n8n caller working). Once this runs, requests
 * for that key MUST carry a valid `X-Signature` / `X-Signature-Timestamp`
 * (HMAC-SHA256 over `<timestamp>.<rawBody>`, see src/lib/ingest/signing.ts).
 *
 * ⚠️ Turning signing on for a LIVE key is a breaking change for that caller —
 * update the caller (n8n) to sign BEFORE or in the same change window.
 *
 * The secret is shown only here and is not recoverable; rerun to rotate.
 */
import { rotateApiKeySigningSecret } from "@/lib/ingest/api-keys";

async function main() {
  const keyId = process.argv[2];
  if (!keyId) {
    console.error("Usage: enable-signing.ts <apiKeyId>");
    process.exit(1);
  }

  const { signingSecret } = await rotateApiKeySigningSecret(keyId);

  console.log("");
  console.log("  Signing enabled — copy the secret now, it will not be shown again:");
  console.log("");
  console.log(`    ${signingSecret}`);
  console.log("");
  console.log(`  key id: ${keyId}`);
  console.log("");
  console.log("  The signing client must now send, on every ingest request:");
  console.log("    X-Signature-Timestamp: <unix-seconds>");
  console.log("    X-Signature: sha256=<hex HMAC-SHA256 of `<timestamp>.<rawBody>`>");
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
