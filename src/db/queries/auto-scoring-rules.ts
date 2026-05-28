import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";

import { db, schema } from "../client";
import { prefixedId } from "@/lib/ids";
import type { Filter } from "@/lib/filters/types";
import type { AutoScoringRule } from "../schema";

/** Row shape consumed by the rules-list UI: rule + enough scorecard info to
 *  render the routing pill without a follow-up query. `filterPredicate` is
 *  narrowed from the schema's loose `unknown[]` to the strict `Filter[]`
 *  here — callers (UI + engine) can rely on the shape. */
export type AutoScoringRuleListRow = Omit<AutoScoringRule, "filterPredicate"> & {
  filterPredicate: Filter[];
  scorecard: { id: string; name: string; archivedAt: number | null } | null;
};

const RULE_SELECT = {
  rule: schema.autoScoringRules,
  scorecard: {
    id: schema.scorecards.id,
    name: schema.scorecards.name,
    archivedAt: schema.scorecards.archivedAt,
  },
};

function hydrateRule(row: {
  rule: AutoScoringRule;
  scorecard: { id: string; name: string; archivedAt: Date | null } | null;
}): AutoScoringRuleListRow {
  return {
    ...row.rule,
    filterPredicate: (row.rule.filterPredicate ?? []) as Filter[],
    scorecard: row.scorecard
      ? {
          id: row.scorecard.id,
          name: row.scorecard.name,
          archivedAt: row.scorecard.archivedAt
            ? row.scorecard.archivedAt.getTime()
            : null,
        }
      : null,
  };
}

/** All rules for a workspace, ordered by priority ASC then createdAt ASC.
 *  Used by the settings list page (renders both enabled + disabled rules). */
export async function listAutoScoringRules(
  workspaceId: string,
): Promise<AutoScoringRuleListRow[]> {
  const rows = await db
    .select(RULE_SELECT)
    .from(schema.autoScoringRules)
    .leftJoin(
      schema.scorecards,
      eq(schema.scorecards.id, schema.autoScoringRules.scorecardId),
    )
    .where(eq(schema.autoScoringRules.workspaceId, workspaceId))
    .orderBy(
      asc(schema.autoScoringRules.priority),
      asc(schema.autoScoringRules.createdAt),
    );
  return rows.map(hydrateRule);
}

/** Enabled rules only, ordered by priority ASC. Hot path: called from
 *  `tryAutoScore` on every ingested resolved ticket. */
export async function listEnabledAutoScoringRules(
  workspaceId: string,
): Promise<AutoScoringRuleListRow[]> {
  const rows = await db
    .select(RULE_SELECT)
    .from(schema.autoScoringRules)
    .leftJoin(
      schema.scorecards,
      eq(schema.scorecards.id, schema.autoScoringRules.scorecardId),
    )
    .where(
      and(
        eq(schema.autoScoringRules.workspaceId, workspaceId),
        eq(schema.autoScoringRules.enabled, true),
      ),
    )
    .orderBy(
      asc(schema.autoScoringRules.priority),
      asc(schema.autoScoringRules.createdAt),
    );
  return rows.map(hydrateRule);
}

export async function getAutoScoringRule(
  workspaceId: string,
  id: string,
): Promise<AutoScoringRuleListRow | null> {
  const [row] = await db
    .select(RULE_SELECT)
    .from(schema.autoScoringRules)
    .leftJoin(
      schema.scorecards,
      eq(schema.scorecards.id, schema.autoScoringRules.scorecardId),
    )
    .where(
      and(
        eq(schema.autoScoringRules.workspaceId, workspaceId),
        eq(schema.autoScoringRules.id, id),
      ),
    )
    .limit(1);
  return row ? hydrateRule(row) : null;
}

export type CreateAutoScoringRuleInput = {
  workspaceId: string;
  name: string;
  enabled?: boolean;
  filterPredicate?: Filter[];
  scorecardId: string;
  samplingPercent?: number;
  dailyCap?: number | null;
  priority?: number;
  createdBy?: string | null;
};

export async function createAutoScoringRule(
  input: CreateAutoScoringRuleInput,
): Promise<string> {
  const id = prefixedId("asr");
  const priority =
    input.priority ??
    (await nextAvailablePriority(input.workspaceId));
  await db.insert(schema.autoScoringRules).values({
    id,
    workspaceId: input.workspaceId,
    name: input.name,
    enabled: input.enabled ?? true,
    filterPredicate: (input.filterPredicate ?? []) as unknown[],
    scorecardId: input.scorecardId,
    samplingPercent: input.samplingPercent ?? 100,
    dailyCap: input.dailyCap ?? null,
    priority,
    createdBy: input.createdBy ?? null,
  });
  return id;
}

export type UpdateAutoScoringRuleInput = Partial<{
  name: string;
  enabled: boolean;
  filterPredicate: Filter[];
  scorecardId: string;
  samplingPercent: number;
  dailyCap: number | null;
  priority: number;
}>;

export async function updateAutoScoringRule(
  workspaceId: string,
  id: string,
  input: UpdateAutoScoringRuleInput,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set: Record<string, any> = { updatedAt: new Date() };
  if (input.name !== undefined) set.name = input.name;
  if (input.enabled !== undefined) set.enabled = input.enabled;
  if (input.filterPredicate !== undefined)
    set.filterPredicate = input.filterPredicate as unknown[];
  if (input.scorecardId !== undefined) set.scorecardId = input.scorecardId;
  if (input.samplingPercent !== undefined)
    set.samplingPercent = input.samplingPercent;
  if (input.dailyCap !== undefined) set.dailyCap = input.dailyCap;
  if (input.priority !== undefined) set.priority = input.priority;

  await db
    .update(schema.autoScoringRules)
    .set(set)
    .where(
      and(
        eq(schema.autoScoringRules.workspaceId, workspaceId),
        eq(schema.autoScoringRules.id, id),
      ),
    );
}

export async function deleteAutoScoringRule(
  workspaceId: string,
  id: string,
): Promise<void> {
  await db
    .delete(schema.autoScoringRules)
    .where(
      and(
        eq(schema.autoScoringRules.workspaceId, workspaceId),
        eq(schema.autoScoringRules.id, id),
      ),
    );
}

/** Reassign priorities so the supplied ordered list lands at 100, 200, 300...
 *  Spreading by 100s leaves headroom for ad-hoc inserts without a full
 *  re-numbering, while still keeping the values bounded and human-readable. */
export async function reorderAutoScoringRules(
  workspaceId: string,
  orderedIds: string[],
): Promise<void> {
  // Sequential (not Promise.all) so libsql doesn't see concurrent writes
  // contending on the same rows.
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(schema.autoScoringRules)
      .set({ priority: (i + 1) * 100, updatedAt: new Date() })
      .where(
        and(
          eq(schema.autoScoringRules.workspaceId, workspaceId),
          eq(schema.autoScoringRules.id, orderedIds[i]),
        ),
      );
  }
}

async function nextAvailablePriority(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({
      max: sql<number>`COALESCE(MAX(${schema.autoScoringRules.priority}), 0)`,
    })
    .from(schema.autoScoringRules)
    .where(eq(schema.autoScoringRules.workspaceId, workspaceId));
  return (row?.max ?? 0) + 100;
}

/** Count of evaluations attributed to this rule since the start of the
 *  current UTC day. Used for the daily-cap gate inside `tryAutoScore`. */
export async function countEvaluationsForRuleToday(
  ruleId: string,
): Promise<number> {
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.evaluations)
    .where(
      and(
        eq(schema.evaluations.autoScoringRuleId, ruleId),
        gte(schema.evaluations.scoredAt, startOfUtcDay),
      ),
    );
  return row?.count ?? 0;
}

/** Count of evaluations attributed to ANY rule in the workspace in the last
 *  24h. Powers the "Last 24h: N tickets scored across all rules" footer on
 *  the settings list page. Window is rolling, not start-of-day, so the user
 *  always sees fresh signal regardless of when they look. */
export async function countEvaluationsByRulesLast24h(
  workspaceId: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.evaluations)
    .where(
      and(
        eq(schema.evaluations.workspaceId, workspaceId),
        sql`${schema.evaluations.autoScoringRuleId} IS NOT NULL`,
        gte(schema.evaluations.scoredAt, since),
      ),
    );
  return row?.count ?? 0;
}

/** Check whether a (ticket, scorecard) pair already has a recorded
 *  evaluation. Used as `tryAutoScore`'s idempotency guard so a helpdesk
 *  re-POSTing the same resolved ticket can't produce duplicate evaluations
 *  on the same rubric. */
export async function evaluationExistsForTicketAndScorecard(
  ticketId: string,
  scorecardId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(schema.evaluations)
    .where(
      and(
        eq(schema.evaluations.ticketId, ticketId),
        eq(schema.evaluations.scorecardId, scorecardId),
      ),
    )
    .limit(1);
  return Boolean(row);
}
