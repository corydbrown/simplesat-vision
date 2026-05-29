/**
 * Backfill `team_member_id` on existing bot messages.
 *
 * Bot turns ingested before SVP-270 landed with `team_member_id = NULL`
 * (`author_role = "agent" AND author_subtype = "bot"`). This walks them per
 * workspace and attributes each to that workspace's AI team_member, lazy-
 * creating the row via `lazyCreateAiTeamMember` (the exact path the ingest hook
 * now uses).
 *
 * Provider: `intercom_fin` across the board. Both workspaces with bot traffic
 * today (Simplesat + Pronto) run Intercom Fin, and `ticket_messages` carries no
 * `author_name` to distinguish other vendors — see `planBotBackfill`. Multi-
 * provider backfill waits on plumbing the raw author through ingest.
 *
 * Idempotent: only NULL-team_member bot messages are candidates, so a re-run
 * after a successful pass finds nothing.
 *
 * Usage:
 *   set -a && source .env.local && set +a   # load TURSO_DATABASE_URL etc.
 *   npm run db:backfill:bot-team-members -- [flags]
 *
 * Flags:
 *   --dry-run            Log the per-workspace plan and counts. Write nothing.
 *   --workspace <id>     Limit to one workspace (defaults to all).
 *   --limit <n>          Cap candidate rows scanned (default: no limit).
 */
import { and, eq, isNull, inArray } from "drizzle-orm";

import { db } from "../src/db/client";
import { ticketMessages, tickets } from "../src/db/schema";
import { lazyCreateAiTeamMember } from "../src/lib/team-members/ai-detection";
import {
  planBotBackfill,
  type BotMessageRow,
} from "../src/lib/team-members/bot-backfill";

type Flags = {
  dryRun: boolean;
  workspaceId: string | null;
  limit: number | null;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, workspaceId: null, limit: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") {
      flags.dryRun = true;
    } else if (a === "--workspace") {
      flags.workspaceId = argv[++i] ?? null;
    } else if (a === "--limit") {
      flags.limit = Number(argv[++i]);
      if (!Number.isFinite(flags.limit) || flags.limit <= 0) {
        throw new Error("--limit must be a positive integer");
      }
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: tsx scripts/backfill-bot-team-member-ids.ts " +
          "[--dry-run] [--workspace <id>] [--limit N]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  return flags;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  console.log(
    `[backfill-bot-team-members] start ` +
      `workspace=${flags.workspaceId ?? "(all)"} ` +
      `limit=${flags.limit ?? "(none)"} dryRun=${flags.dryRun}`,
  );

  // Candidates: bot turns still missing attribution. workspace_id rides on the
  // parent ticket (messages aren't workspace-scoped), so join through it.
  const conditions = [
    eq(ticketMessages.authorRole, "agent"),
    eq(ticketMessages.authorSubtype, "bot"),
    isNull(ticketMessages.teamMemberId),
  ];
  if (flags.workspaceId) {
    conditions.push(eq(tickets.workspaceId, flags.workspaceId));
  }

  const rows: BotMessageRow[] = await db
    .select({ id: ticketMessages.id, workspaceId: tickets.workspaceId })
    .from(ticketMessages)
    .innerJoin(tickets, eq(ticketMessages.ticketId, tickets.id))
    .where(and(...conditions))
    .limit(flags.limit ?? 10_000_000);

  const plans = planBotBackfill(rows);
  const total = rows.length;

  console.log(
    `[backfill-bot-team-members] candidates=${total} ` +
      `workspaces=${plans.length}`,
  );
  for (const plan of plans) {
    console.log(
      `  ${plan.workspaceId}: ${plan.messageIds.length} message(s) → ${plan.provider}`,
    );
  }

  if (flags.dryRun) {
    console.log(`[backfill-bot-team-members] dry-run — no writes. would update ${total} row(s).`);
    return;
  }

  let updated = 0;
  for (const plan of plans) {
    const teamMemberId = await lazyCreateAiTeamMember(
      plan.workspaceId,
      plan.provider,
    );
    // Chunk the IN-list so a workspace with thousands of bot turns doesn't
    // blow past SQLite's bound-parameter limit.
    for (let i = 0; i < plan.messageIds.length; i += 500) {
      const chunk = plan.messageIds.slice(i, i + 500);
      const res = await db
        .update(ticketMessages)
        .set({ teamMemberId })
        .where(
          and(
            inArray(ticketMessages.id, chunk),
            // Re-guard NULL at write time so a concurrent ingest that already
            // attributed a row can't be clobbered between SELECT and UPDATE.
            isNull(ticketMessages.teamMemberId),
          ),
        );
      updated += Number((res as { rowsAffected?: number }).rowsAffected ?? 0);
    }
    console.log(
      `  [updated] ${plan.workspaceId}: team_member=${teamMemberId} ` +
        `(${plan.messageIds.length} message(s))`,
    );
  }

  console.log(
    `[backfill-bot-team-members] done updated=${updated} total=${total}`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
