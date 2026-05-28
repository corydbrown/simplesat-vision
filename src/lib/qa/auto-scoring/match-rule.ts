import "server-only";
import { and, eq, sql } from "drizzle-orm";

import { db, schema } from "@/db/client";
import { compileListFilters } from "@/lib/filters/compile-list";
import { TICKET_FILTER_FIELDS } from "@/lib/filters/fields/tickets";
import type { Filter } from "@/lib/filters/types";

/** Does a single ticket match a rule's filter predicate? Re-runs the same
 *  filter compiler the URL `?f=` filters use, so the predicate stored in
 *  `auto_scoring_rules.filter_predicate` is semantically identical to what
 *  the user sees in the editor's live preview.
 *
 *  Empty predicate ([]) → `compileListFilters` returns undefined → match all
 *  (the default rule's behavior).
 *
 *  Implementation is `SELECT 1 FROM tickets WHERE id=? AND <where>` rather
 *  than an in-memory filter evaluator because the filter compiler emits raw
 *  SQL fragments (correlated subqueries against ticket_events, response
 *  ratings, etc.) that wouldn't survive a JS port. */
export async function ticketMatchesRule(
  ticketId: string,
  workspaceId: string,
  predicate: Filter[],
): Promise<boolean> {
  const filterWhere = compileListFilters(predicate, TICKET_FILTER_FIELDS);
  const baseWhere = and(
    eq(schema.tickets.id, ticketId),
    eq(schema.tickets.workspaceId, workspaceId),
  );
  const where = filterWhere ? and(baseWhere, filterWhere) : baseWhere;

  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(schema.tickets)
    .where(where)
    .limit(1);
  return Boolean(row);
}

/** List the ids of tickets in a workspace that match a rule's filter and
 *  don't already have an evaluation against the rule's scorecard. Used by
 *  the "Run now" button to backfill a rule across the existing dataset.
 *
 *  `limit` is honored verbatim — the caller (run-rule-once) typically caps
 *  it at the rule's daily cap. */
export async function listTicketIdsMatchingRule(
  workspaceId: string,
  predicate: Filter[],
  options: {
    excludeAlreadyScoredWith?: string;
    limit: number;
    resolvedOnly?: boolean;
  },
): Promise<string[]> {
  const filterWhere = compileListFilters(predicate, TICKET_FILTER_FIELDS);
  const conditions = [eq(schema.tickets.workspaceId, workspaceId)];
  if (filterWhere) conditions.push(filterWhere);
  if (options.resolvedOnly) {
    conditions.push(eq(schema.tickets.isResolved, true));
  }
  if (options.excludeAlreadyScoredWith) {
    conditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM evaluations
         WHERE evaluations.ticket_id = tickets.id
           AND evaluations.scorecard_id = ${options.excludeAlreadyScoredWith}
      )`,
    );
  }

  const rows = await db
    .select({ id: schema.tickets.id })
    .from(schema.tickets)
    .where(and(...conditions))
    .limit(options.limit);
  return rows.map((r) => r.id);
}

/** Count of tickets in a workspace that would match a rule's predicate.
 *  Powers the live-preview "N eligible" chip in the rule editor. Does NOT
 *  exclude already-scored tickets — the editor wants to show "this is what
 *  this filter selects," and on-the-fly de-dup is the engine's job. */
export async function countTicketsMatchingPredicate(
  workspaceId: string,
  predicate: Filter[],
  options: { resolvedOnly?: boolean } = {},
): Promise<number> {
  const filterWhere = compileListFilters(predicate, TICKET_FILTER_FIELDS);
  const conditions = [eq(schema.tickets.workspaceId, workspaceId)];
  if (filterWhere) conditions.push(filterWhere);
  if (options.resolvedOnly) {
    conditions.push(eq(schema.tickets.isResolved, true));
  }
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.tickets)
    .where(and(...conditions));
  return row?.count ?? 0;
}
