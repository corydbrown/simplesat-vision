/**
 * SVP-162 — verify listAllSavedViews works and compare round-trip cost
 * against the previous 5-call shape. Both go to the same Turso DB so the
 * delta is real protocol + server-action overhead, not just SQL execution.
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set.");
  process.exit(1);
}
const client = createClient({ url, authToken });

const ENTITIES = ["tickets", "customers", "responses", "team-members", "coaching"];

const PER_ENTITY_SQL = `
  SELECT * FROM saved_views
  WHERE workspace_id = ? AND entity = ?
  ORDER BY position ASC, created_at ASC
`;

const ALL_SQL = `
  SELECT * FROM saved_views
  WHERE workspace_id = ?
  ORDER BY entity ASC, position ASC, created_at ASC
`;

async function main() {
  await client.execute("SELECT 1"); // warm

  const wid = "wks_bloom_beauty";

  // OLD shape: 5 parallel reads (mirrors ViewsProvider's Promise.all).
  const tOld = performance.now();
  const old = await Promise.all(
    ENTITIES.map((e) =>
      client.execute({ sql: PER_ENTITY_SQL, args: [wid, e] }),
    ),
  );
  const oldWall = performance.now() - tOld;
  const oldTotalRows = old.reduce((n, r) => n + r.rows.length, 0);
  console.log(`5 parallel per-entity: ${oldWall.toFixed(0)}ms (${oldTotalRows} rows total)`);

  // NEW shape: one read, group in memory.
  const tNew = performance.now();
  const all = await client.execute({ sql: ALL_SQL, args: [wid] });
  const newWall = performance.now() - tNew;
  const grouped: Record<string, number> = {};
  for (const row of all.rows) {
    const e = String(row.entity);
    grouped[e] = (grouped[e] ?? 0) + 1;
  }
  console.log(`1 batched read:        ${newWall.toFixed(0)}ms (${all.rows.length} rows total)`);
  console.log(`  group counts: ${JSON.stringify(grouped)}`);

  console.log(
    `\nWin (DB layer only — server action + auth overhead is separate): ${(oldWall - newWall).toFixed(0)}ms`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
