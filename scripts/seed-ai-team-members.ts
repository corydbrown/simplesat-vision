/**
 * Seed AI team_member rows for workspaces that have AI agents deployed.
 *
 * Idempotent — safe to re-run; existing rows are returned (by
 * `lazyCreateAiTeamMember`), not duplicated.
 *
 * Run locally:
 *   set -a && source .env.local && set +a
 *   npm run db:seed:ai-team-members
 *
 * Run against Turso prod (requires explicit go-ahead — STOP_CONDITIONS):
 *   set -a && source .env.local && set +a
 *   tsx --conditions=react-server scripts/seed-ai-team-members.ts
 *
 * Scope (SVP-269 brief): Simplesat only. Pronto is not pre-seeded — Fin lazy-
 * creates on first ingested bot message via the Phase 1c hook. Bloom is OUT.
 */
import { eq } from "drizzle-orm";

import { db } from "../src/db/client";
import { workspaces } from "../src/db/schema";
import { lazyCreateAiTeamMember } from "../src/lib/team-members/ai-detection";

const SIMPLESAT_WORKSPACE_ID = "wks_simplesat";

async function main() {
  const [ws] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, SIMPLESAT_WORKSPACE_ID))
    .limit(1);
  if (!ws) {
    console.error(
      `Workspace ${SIMPLESAT_WORKSPACE_ID} missing — run db:migrate first.`,
    );
    process.exit(1);
  }

  const id = await lazyCreateAiTeamMember(
    SIMPLESAT_WORKSPACE_ID,
    "intercom_fin",
    { model: "fin-v2", deployedAt: new Date() },
  );
  console.log(`Simplesat Fin team_member: ${id}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
