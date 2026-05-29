import type { AiProvider } from "./ai-detection";

/** A stored bot message that still needs AI attribution. `workspaceId` comes
 *  from the parent ticket — `ticket_messages` carries no `workspace_id` of its
 *  own (messages are scoped via the ticket). */
export type BotMessageRow = { id: string; workspaceId: string };

/** Per-workspace backfill unit: which AI team_member every NULL-attributed bot
 *  message in that workspace should resolve to, plus the message ids. */
export type WorkspaceBackfillPlan = {
  workspaceId: string;
  provider: AiProvider;
  messageIds: string[];
};

/** Pure. Group NULL-team-member bot messages into a per-workspace backfill plan.
 *
 *  Every bot message today resolves to Intercom Fin: both workspaces with bot
 *  traffic (Simplesat + Pronto) run Fin, and the raw author payload that would
 *  let us tell providers apart is gone by the time a row is stored (and
 *  `ticket_messages` has no `author_name` column to sniff). So `provider` is
 *  `intercom_fin` across the board — a deliberate, documented default, not a
 *  guess. Multi-provider backfill waits on plumbing the raw author through
 *  ingest.
 *
 *  Insertion-ordered: workspaces appear in first-seen order, message ids in
 *  input order, so a dry-run's logged counts are stable across runs. */
export function planBotBackfill(rows: BotMessageRow[]): WorkspaceBackfillPlan[] {
  const byWorkspace = new Map<string, string[]>();
  for (const row of rows) {
    const ids = byWorkspace.get(row.workspaceId);
    if (ids) {
      ids.push(row.id);
    } else {
      byWorkspace.set(row.workspaceId, [row.id]);
    }
  }
  return [...byWorkspace.entries()].map(([workspaceId, messageIds]) => ({
    workspaceId,
    provider: "intercom_fin" as const,
    messageIds,
  }));
}
