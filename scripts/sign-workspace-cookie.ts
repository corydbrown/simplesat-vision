import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const workspaceId = process.argv[2];
if (!workspaceId) {
  console.error("usage: tsx scripts/sign-workspace-cookie.ts <workspace_id>");
  process.exit(1);
}

let secret = process.env.WORKOS_COOKIE_PASSWORD;
if (!secret) {
  try {
    const env = readFileSync(".env.local", "utf8");
    const match = env.match(/^WORKOS_COOKIE_PASSWORD=(.+)$/m);
    if (match) secret = match[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
}
if (!secret) {
  console.error("WORKOS_COOKIE_PASSWORD not set (checked env + .env.local)");
  process.exit(1);
}

const signature = createHmac("sha256", secret).update(workspaceId).digest("hex");
console.log(`${workspaceId}.${signature}`);
