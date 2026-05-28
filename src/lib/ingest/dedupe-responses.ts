import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { responses } from "@/db/schema";

/** Mark all non-winning responses on a ticket as `superseded_by` the winner.
 *
 *  Called from `upsertResponse` after every write so the ticket's set of
 *  responses re-converges on the rule: prefer `source = 'simplesat'`; within
 *  the preferred source, take the most recent `respondedAt` (then highest
 *  `id`, for determinism).
 *
 *  Also called from `scripts/dedupe-responses.ts` to backfill existing tickets.
 *
 *  Idempotent: re-running on a converged ticket is a no-op. Re-evaluating a
 *  ticket whose winner changed (e.g. a new Simplesat response arriving after
 *  an Intercom one) flips the chain correctly — losers re-point at the new
 *  winner; the prior winner (if now a loser) gets superseded_by set; a row
 *  that becomes the winner has its superseded_by/at cleared.
 *
 *  Hook ordering: dedupe MUST run BEFORE any topic-attachment hook
 *  (sibling SVP-182) — there's no point attaching topics to a row that's
 *  about to be marked superseded.
 *
 *  Returns the count of rows that had their supersede state changed (useful
 *  for the backfill script's reporting).
 */
export async function dedupeTicketResponses(
  workspaceId: string,
  ticketId: string,
): Promise<number> {
  const rows = await db
    .select({
      id: responses.id,
      source: responses.source,
      respondedAt: responses.respondedAt,
      supersededBy: responses.supersededBy,
      supersededAt: responses.supersededAt,
    })
    .from(responses)
    .where(
      and(
        eq(responses.workspaceId, workspaceId),
        eq(responses.ticketId, ticketId),
      ),
    );

  if (rows.length === 0) return 0;

  if (rows.length === 1) {
    const only = rows[0];
    if (only.supersededBy !== null || only.supersededAt !== null) {
      await db
        .update(responses)
        .set({ supersededBy: null, supersededAt: null })
        .where(eq(responses.id, only.id));
      return 1;
    }
    return 0;
  }

  const winner = [...rows].sort((a, b) => {
    const aSimplesat = a.source === "simplesat" ? 1 : 0;
    const bSimplesat = b.source === "simplesat" ? 1 : 0;
    if (aSimplesat !== bSimplesat) return bSimplesat - aSimplesat;
    const aTime = a.respondedAt instanceof Date ? a.respondedAt.getTime() : 0;
    const bTime = b.respondedAt instanceof Date ? b.respondedAt.getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.id < b.id ? 1 : -1;
  })[0];

  const now = new Date();
  let changed = 0;

  for (const row of rows) {
    if (row.id === winner.id) {
      if (row.supersededBy !== null || row.supersededAt !== null) {
        await db
          .update(responses)
          .set({ supersededBy: null, supersededAt: null })
          .where(eq(responses.id, row.id));
        changed += 1;
      }
      continue;
    }
    if (row.supersededBy === winner.id) continue;
    await db
      .update(responses)
      .set({ supersededBy: winner.id, supersededAt: now })
      .where(eq(responses.id, row.id));
    changed += 1;
  }

  return changed;
}

/** Find every ticket in a workspace that has more than one response. Used by
 *  the backfill script. Returns each ticketId paired with its count. */
export async function findTicketsWithMultipleResponses(
  workspaceId: string,
): Promise<Array<{ ticketId: string; count: number }>> {
  // Drizzle's groupBy is awkward for SELECT ticket_id, COUNT(*) here; the
  // sql-tagged shape below is the same pattern other queries use.
  const all = await db
    .select({ ticketId: responses.ticketId })
    .from(responses)
    .where(
      and(
        eq(responses.workspaceId, workspaceId),
        isNotNull(responses.ticketId),
      ),
    );

  const counts = new Map<string, number>();
  for (const r of all) counts.set(r.ticketId, (counts.get(r.ticketId) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, c]) => c > 1)
    .map(([ticketId, count]) => ({ ticketId, count }));
}
