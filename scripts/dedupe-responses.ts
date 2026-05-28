/**
 * SVP-181 backfill: re-evaluate every ticket with multiple `responses` rows
 * and apply the same dedupe rule the ingest path now enforces (helpdesk-native
 * loses to Simplesat-native; among same-source rows the most recent wins).
 *
 * Idempotent — running twice in a row is a no-op on the second pass. Designed
 * to run against the local DB before merge; the supervisor will repeat on
 * Turso when hand-applying migration 0022.
 *
 * Run:
 *   set -a && source .env.local && set +a && tsx --conditions=react-server scripts/dedupe-responses.ts --dry-run
 *   set -a && source .env.local && set +a && tsx --conditions=react-server scripts/dedupe-responses.ts
 */
import { sql } from "drizzle-orm";

import { db } from "../src/db/client";
import {
  dedupeTicketResponses,
  findTicketsWithMultipleResponses,
} from "../src/lib/ingest/dedupe-responses";

async function listWorkspaces(): Promise<string[]> {
  const rows = await db.all<{ id: string }>(sql`SELECT id FROM workspaces`);
  return rows.map((r) => r.id);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const workspaceIds = await listWorkspaces();
  console.log(
    `[svp181-backfill] ${dryRun ? "[DRY-RUN] " : ""}scanning ${workspaceIds.length} workspace(s)`,
  );

  let totalTicketsEvaluated = 0;
  let totalRowsChanged = 0;

  for (const workspaceId of workspaceIds) {
    const candidates = await findTicketsWithMultipleResponses(workspaceId);
    if (candidates.length === 0) {
      console.log(`  ${workspaceId}: no tickets with multiple responses`);
      continue;
    }
    console.log(
      `  ${workspaceId}: ${candidates.length} ticket(s) with multiple responses`,
    );

    for (const { ticketId, count } of candidates) {
      totalTicketsEvaluated += 1;
      if (dryRun) {
        // Show what each candidate ticket has so the operator can eyeball.
        const rows = await db.all<{
          id: string;
          source: string;
          rating: number;
          superseded_by: string | null;
        }>(sql`
          SELECT id, source, rating, superseded_by
          FROM responses
          WHERE workspace_id = ${workspaceId} AND ticket_id = ${ticketId}
          ORDER BY responded_at DESC
        `);
        console.log(
          `    ticket ${ticketId} (${count} responses):`,
          rows
            .map(
              (r) =>
                `${r.id}[source=${r.source} rating=${r.rating}${r.superseded_by ? " superseded" : ""}]`,
            )
            .join(" "),
        );
        continue;
      }
      const changed = await dedupeTicketResponses(workspaceId, ticketId);
      if (changed > 0) totalRowsChanged += changed;
    }
  }

  console.log(
    `[svp181-backfill] ${dryRun ? "[DRY-RUN] would evaluate" : "evaluated"} ${totalTicketsEvaluated} ticket(s); ${dryRun ? "would change" : "changed"} ${totalRowsChanged} row(s)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
