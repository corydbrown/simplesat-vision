/**
 * Install AI Scorecard v2 — the wedge rubric (6 criteria + the derived
 * Bullshit Detector). Idempotent.
 *
 * Primary target is the Simplesat workspace where Sim (Intercom Fin) has
 * production conversations to score against. Pronto already runs the Phase
 * 2b clone (`AI Quality (Internal)`) and is left alone — this installs
 * alongside, it does NOT replace the older scorecard.
 *
 * Usage:
 *   set -a && source .env.local && set +a   # load TURSO_DATABASE_URL + token
 *   npx tsx --conditions=react-server scripts/install-ai-scorecard-v2-simplesat.ts
 *
 * Flags:
 *   --workspace <id>   Override the target workspace id (default: wks_simplesat).
 *   --dry-run          Print the plan without writing.
 */

import { eq } from "drizzle-orm";

import { db, schema } from "../src/db/client";
import {
  AI_SCORECARD_V2,
  installAiScorecardV2,
} from "../src/lib/qa/ai-scorecard-v2";

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
    `Installing AI Scorecard v2 onto workspace ${flags.workspaceId}${flags.dryRun ? " (dry run)" : ""}...`,
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

  const criteria = AI_SCORECARD_V2.categories.flatMap((c) => c.criteria);
  const weightSum = criteria.reduce((acc, cr) => acc + cr.weightPercent, 0);
  console.log(
    `  Spec: ${AI_SCORECARD_V2.categories.length} categories, ${criteria.length} criteria (sum ${weightSum}%) · applies_to=${AI_SCORECARD_V2.appliesTo}`,
  );
  console.log(
    `  Bullshit Detector trips when "Answer directness" + "Recognition of limits" + "Customer time respect" all score ≤ 2 on the same eval.`,
  );

  if (flags.dryRun) {
    console.log("Dry run — no writes performed.");
    return;
  }

  const result = await installAiScorecardV2(flags.workspaceId);
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
