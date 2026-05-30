/**
 * Local manual walk: install AI Scorecard v2 onto a workspace, seed an AI
 * team_member, score a handful of tickets against the v2 scorecard via the
 * mock provider, and print the resulting Bullshit Detector stats.
 *
 * Not idempotent on the scoring side — re-running scores additional
 * evaluations for the same tickets. Intended as a one-shot dev gate.
 *
 * Run:
 *   set -a && source .env.local && set +a
 *   npx tsx --conditions=react-server scripts/walk-bullshit-detector.ts
 *
 * Flags:
 *   --workspace <id>    Workspace to target (default: wks_bloom_beauty — the
 *                       only workspace with seeded tickets in a fresh local DB).
 *   --limit <n>         Number of tickets to score (default: 12).
 */
import { eq, sql } from "drizzle-orm";

import { db, schema } from "../src/db/client";
import { installAiScorecardV2 } from "../src/lib/qa/ai-scorecard-v2";
import { scoreAndPersistTicket } from "../src/lib/qa/scoring/persist";
import { MockScoringProvider } from "../src/lib/qa/scoring/mock-provider";
import { lazyCreateAiTeamMember } from "../src/lib/team-members/ai-detection";
import {
  BULLSHIT_DETECTOR_CRITERIA,
  BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW,
  BULLSHIT_DETECTOR_SCORECARD_NAME,
} from "../src/lib/qa/bullshit-detector";

type Flags = { workspaceId: string; limit: number };

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { workspaceId: "wks_bloom_beauty", limit: 12 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--workspace") flags.workspaceId = argv[++i]!;
    else if (a === "--limit") flags.limit = Number(argv[++i]);
    else throw new Error(`Unknown flag: ${a}`);
  }
  return flags;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const [ws] = await db
    .select({ id: schema.workspaces.id, name: schema.workspaces.name })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, flags.workspaceId))
    .limit(1);
  if (!ws) throw new Error(`workspace ${flags.workspaceId} missing`);
  console.log(`Workspace: ${ws.name} (${ws.id})`);

  const simId = await lazyCreateAiTeamMember(flags.workspaceId, "intercom_fin", {
    model: "fin-v2",
    deployedAt: new Date(),
  });
  console.log(`Sim team_member: ${simId}`);

  const install = await installAiScorecardV2(flags.workspaceId);
  console.log(
    install.skipped
      ? `v2 scorecard already installed (${install.scorecardId})`
      : `installed v2 scorecard ${install.scorecardId}`,
  );

  // Only tickets with messages — mock provider asserts message presence.
  const tickets = await db.all<{ id: string }>(sql`
    SELECT t.id AS id
    FROM tickets t
    WHERE t.workspace_id = ${flags.workspaceId}
      AND EXISTS (SELECT 1 FROM ticket_messages tm WHERE tm.ticket_id = t.id)
    ORDER BY RANDOM()
    LIMIT ${flags.limit}
  `);
  console.log(`Scoring ${tickets.length} tickets against v2 (mock provider)...`);

  const provider = new MockScoringProvider();
  for (const t of tickets) {
    try {
      await scoreAndPersistTicket({
        ticketId: t.id,
        workspaceId: flags.workspaceId,
        scorecardId: install.scorecardId,
        scoredTeamMemberId: simId,
        provider,
      });
    } catch (err) {
      console.warn(`  skipped ${t.id}: ${(err as Error).message}`);
    }
  }

  // Query-time bullshit count, mirroring getTeamMemberBullshitStats.
  const rows = await db.all<{ scored_at: number }>(sql`
    SELECT e.scored_at AS scored_at
    FROM evaluations e
    INNER JOIN scorecards s ON s.id = e.scorecard_id
    INNER JOIN evaluation_category_scores ecs ON ecs.evaluation_id = e.id
    INNER JOIN scorecard_categories sc ON sc.id = ecs.category_id
    WHERE e.workspace_id = ${flags.workspaceId}
      AND e.scored_team_member_id = ${simId}
      AND e.status != 'invalidated'
      AND s.name = ${BULLSHIT_DETECTOR_SCORECARD_NAME}
      AND sc.name IN (${sql.join(
        BULLSHIT_DETECTOR_CRITERIA.map((n: string) => sql`${n}`),
        sql`, `,
      )})
      AND ecs.effective_score <= ${BULLSHIT_DETECTOR_FAIL_AT_OR_BELOW}
    GROUP BY e.id, e.scored_at
    HAVING COUNT(DISTINCT sc.name) = ${BULLSHIT_DETECTOR_CRITERIA.length}
  `);

  const totalEvals = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.evaluations)
    .where(eq(schema.evaluations.scoredTeamMemberId, simId));
  console.log("");
  console.log(`Total Sim evals: ${totalEvals[0]?.n ?? 0}`);
  console.log(`Bullshit-flagged evals: ${rows.length}`);
  console.log(`Hit at /agents/${simId}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
