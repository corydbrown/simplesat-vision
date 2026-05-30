/**
 * Install Resolution Scorecard v1 — the third leaf of Quality's tri-card eval
 * (alongside Human and AI). Grades customer outcome, fires once per ticket,
 * `scored_team_member_id` lands NULL (no individual owns the score).
 * Idempotent.
 *
 * Primary target is the Simplesat workspace where Sim (Intercom Fin) is in
 * production and the Resolution rubric has live mixed-actor tickets to score
 * against. Other workspaces install on demand via `--workspace`.
 *
 * Usage:
 *   set -a && source .env.local && set +a   # load TURSO_DATABASE_URL + token
 *   npx tsx --conditions=react-server scripts/install-resolution-scorecard-v1.ts
 *
 * Flags:
 *   --workspace <id>   Override the target workspace id (default: wks_simplesat).
 *   --dry-run          Print the plan without writing.
 */

import { eq } from "drizzle-orm";

import { db, schema } from "../src/db/client";
import {
  RESOLUTION_SCORECARD_V1,
  installResolutionScorecardV1,
} from "../src/lib/qa/resolution-scorecard-v1";

type Flags = {
  workspaceId: string;
  dryRun: boolean;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { workspaceId: "wks_simplesat", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--workspace") {
      const next = argv[i + 1];
      if (!next) throw new Error("--workspace requires a value");
      flags.workspaceId = next;
      i++;
    } else if (arg === "--dry-run") {
      flags.dryRun = true;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return flags;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  console.log(
    `Installing Resolution Scorecard v1 onto workspace ${flags.workspaceId}${flags.dryRun ? " (dry run)" : ""}...`,
  );

  const [workspace] = await db
    .select({ id: schema.workspaces.id, name: schema.workspaces.name })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, flags.workspaceId))
    .limit(1);
  if (!workspace) {
    throw new Error(
      `Workspace ${flags.workspaceId} not found. Refusing to install.`,
    );
  }
  console.log(`  → ${workspace.name} (${workspace.id})`);

  const criteria = RESOLUTION_SCORECARD_V1.categories.flatMap((c) => c.criteria);
  const weightSum = criteria.reduce((acc, cr) => acc + cr.weightPercent, 0);
  console.log(
    `  Spec: ${RESOLUTION_SCORECARD_V1.categories.length} categories, ${criteria.length} criteria (sum ${weightSum}%) · applies_to=${RESOLUTION_SCORECARD_V1.appliesTo}`,
  );
  console.log(
    `  Fires once per ticket on every ticket; scored_team_member_id lands NULL (Resolution scores never roll up to an individual actor).`,
  );

  if (flags.dryRun) {
    console.log("Dry run — no writes performed.");
    return;
  }

  const result = await installResolutionScorecardV1(flags.workspaceId);
  if (result.skipped) {
    console.log(
      `Already installed (scorecard ${result.scorecardId}). Nothing to do.`,
    );
    return;
  }
  console.log("Installed:");
  console.log(`  scorecard:        ${result.scorecardId}`);
  console.log(`  scorecardVersion: ${result.scorecardVersionId}`);
  console.log(
    `  categories:       ${Array.from(result.categoryIdByName.entries())
      .map(([name, id]) => `${name} (${id})`)
      .join(", ")}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
