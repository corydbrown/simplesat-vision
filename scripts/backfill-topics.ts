/**
 * Backfill topics on responses with `topics = []`. Safe to re-run: each row
 * is processed independently and `attachTopicsToResponse({ skipIfAttached:
 * true })` is the per-row guard, so a partial run resumes cleanly.
 *
 * Usage:
 *   set -a && source .env.local && set +a   # load TURSO_DATABASE_URL etc.
 *   npx tsx --conditions=react-server scripts/backfill-topics.ts [flags]
 *
 * Flags:
 *   --dry-run            Walk the rows, call the provider, log what *would*
 *                        be written. Don't write.
 *   --workspace <id>     Limit to one workspace (defaults to all).
 *   --provider mock|llm  Override LLM_TOPIC_PROVIDER for this run.
 *   --limit <n>          Stop after N rows (default: no limit).
 *   --batch <n>          Process N rows in parallel per tick (default: 4).
 *
 * Cost note: with `--provider llm`, every untagged response = one LLM call.
 * Use `--limit` + `--dry-run` first to estimate the bill.
 */

import { eq, and, sql } from "drizzle-orm";

import { db } from "../src/db/client";
import { responses } from "../src/db/schema";
import { attachTopicsToResponse } from "../src/lib/topics/attach";
import { getTopicProvider, type TopicProviderName } from "../src/lib/topics";

type Flags = {
  dryRun: boolean;
  workspaceId: string | null;
  provider: TopicProviderName | null;
  limit: number | null;
  batch: number;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    dryRun: false,
    workspaceId: null,
    provider: null,
    limit: null,
    batch: 4,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") {
      flags.dryRun = true;
    } else if (a === "--workspace") {
      flags.workspaceId = argv[++i] ?? null;
    } else if (a === "--provider") {
      const v = argv[++i];
      if (v !== "mock" && v !== "llm") {
        throw new Error(`--provider must be "mock" or "llm" (got ${v})`);
      }
      flags.provider = v;
    } else if (a === "--limit") {
      flags.limit = Number(argv[++i]);
      if (!Number.isFinite(flags.limit) || flags.limit <= 0) {
        throw new Error("--limit must be a positive integer");
      }
    } else if (a === "--batch") {
      flags.batch = Number(argv[++i]);
      if (!Number.isFinite(flags.batch) || flags.batch <= 0) {
        throw new Error("--batch must be a positive integer");
      }
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: tsx scripts/backfill-topics.ts " +
          "[--dry-run] [--workspace <id>] [--provider mock|llm] " +
          "[--limit N] [--batch N]",
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
  const provider = getTopicProvider(flags.provider ?? undefined);

  console.log(
    `[backfill-topics] start provider=${provider.name} ` +
      `workspace=${flags.workspaceId ?? "(all)"} ` +
      `limit=${flags.limit ?? "(none)"} batch=${flags.batch} ` +
      `dryRun=${flags.dryRun}`,
  );

  // Untagged = topics column equal to the empty-array JSON. Cheaper than
  // pulling every row and filtering in JS, and survives Turso's text storage
  // of JSON columns.
  const conditions = [sql`${responses.topics} = '[]'`];
  if (flags.workspaceId) {
    conditions.push(eq(responses.workspaceId, flags.workspaceId));
  }
  const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

  const rows = await db
    .select({ id: responses.id, workspaceId: responses.workspaceId })
    .from(responses)
    .where(where)
    .limit(flags.limit ?? 10_000_000);

  console.log(`[backfill-topics] candidates=${rows.length}`);

  let attached = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (let i = 0; i < rows.length; i += flags.batch) {
    const slice = rows.slice(i, i + flags.batch);
    const outcomes = await Promise.all(
      slice.map(async (row) => {
        try {
          const result = await attachTopicsToResponse({
            workspaceId: row.workspaceId,
            responseId: row.id,
            provider,
            skipIfAttached: true,
            dryRun: flags.dryRun,
          });
          if (result.ok) {
            return {
              id: row.id,
              kind: flags.dryRun ? ("dry" as const) : ("attached" as const),
              topics: result.topics.map((t) => t.topic),
            };
          }
          return { id: row.id, kind: "skipped" as const };
        } catch (err) {
          return {
            id: row.id,
            kind: "failed" as const,
            err: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    for (const o of outcomes) {
      processed++;
      if (o.kind === "attached") {
        attached++;
        console.log(`  [attach] ${o.id} → ${o.topics.join(", ") || "(none)"}`);
      } else if (o.kind === "dry") {
        console.log(`  [dry-run] ${o.id} → ${o.topics.join(", ") || "(none)"}`);
      } else if (o.kind === "skipped") {
        skipped++;
      } else {
        failed++;
        console.error(`  [fail] ${o.id} — ${o.err}`);
      }
    }
    if (processed % 50 === 0 || processed === rows.length) {
      console.log(
        `[backfill-topics] progress ${processed}/${rows.length} ` +
          `attached=${attached} skipped=${skipped} failed=${failed}`,
      );
    }
  }

  console.log(
    `[backfill-topics] done attached=${attached} skipped=${skipped} ` +
      `failed=${failed} total=${processed}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
