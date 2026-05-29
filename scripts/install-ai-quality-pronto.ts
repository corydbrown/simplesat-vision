/**
 * Install the AI Quality (Internal) scorecard onto a workspace.
 *
 * Idempotent — `installAiQualityScorecard` checks for an existing
 * non-archived scorecard with the same name and skips the insert if found.
 * Safe to re-run.
 *
 * Defaults to `wks_simplesat` (the demo workspace whose tickets have Fin
 * turns); pass `--workspace` to target another. After install, the SVP-232
 * default auto-scoring rule plus the SVP-273 fan-out engine combine to
 * produce AI evaluations for any ticket with bot turns.
 *
 * Usage:
 *   set -a && source .env.local && set +a   # load TURSO_DATABASE_URL + token
 *   npx tsx --conditions=react-server scripts/install-ai-quality-pronto.ts
 *
 * Flags:
 *   --workspace <id>   Override the target workspace id (default: wks_simplesat).
 *   --dry-run          Print the plan without writing.
 */

import { eq } from "drizzle-orm";

import { db, schema } from "../src/db/client";
import {
  AI_QUALITY_SCORECARD,
  installAiQualityScorecard,
} from "../src/lib/qa/ai-quality-scorecard";

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
    `Installing AI Quality (Internal) scorecard onto workspace ${flags.workspaceId}${flags.dryRun ? " (dry run)" : ""}...`,
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

  const nonAutofailCriteria = AI_QUALITY_SCORECARD.categories
    .filter((c) => !c.isAutofail)
    .flatMap((c) => c.criteria);
  console.log(
    `  Spec: ${AI_QUALITY_SCORECARD.categories.length} categories, ${nonAutofailCriteria.length} criteria (sum ${nonAutofailCriteria.reduce((acc, cr) => acc + cr.weightPercent, 0)}%) · applies_to=${AI_QUALITY_SCORECARD.appliesTo}`,
  );

  if (flags.dryRun) {
    console.log("Dry run — no writes performed.");
    return;
  }

  const result = await installAiQualityScorecard(flags.workspaceId);
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
