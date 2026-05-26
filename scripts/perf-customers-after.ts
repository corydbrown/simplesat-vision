/**
 * SVP-162: verify the listCustomers reshape end-to-end against Turso.
 * Runs the exact SQL Drizzle now emits (post-reshape) and times it for
 * each workspace. Compared against the pre-reshape numbers in
 * PERF_FINDINGS.md, this is the win confirmation.
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set.");
  process.exit(1);
}
const client = createClient({ url, authToken });

// Mirrors the SQL Drizzle now emits for listCustomers with no filters / no
// custom sorts (default ORDER BY last_seen DESC).
const NEW_LIST_CUSTOMERS_SQL = `
  SELECT
    customers.id, customers.name, customers.email, customers.company,
    customers.company_external_id, customers.company_domain, customers.language,
    customers.tier, customers.custom_properties,
    COALESCE(t_agg.total_tickets, 0) AS total_tickets,
    r_agg.avg_rating                   AS avg_rating,
    t_agg.last_seen                    AS last_seen
  FROM customers
  LEFT JOIN (
    SELECT customer_id, COUNT(*) AS total_tickets, MAX(created_at) AS last_seen
    FROM tickets
    WHERE workspace_id = ?
    GROUP BY customer_id
  ) t_agg ON t_agg.customer_id = customers.id
  LEFT JOIN (
    SELECT customer_id, AVG(CAST(rating AS REAL)) AS avg_rating
    FROM responses
    WHERE workspace_id = ?
    GROUP BY customer_id
  ) r_agg ON r_agg.customer_id = customers.id
  WHERE customers.workspace_id = ?
  ORDER BY last_seen DESC
`;

async function time(label: string, sql: string, args: string[]) {
  const t0 = performance.now();
  const r = await client.execute({ sql, args });
  const ms = performance.now() - t0;
  console.log(`  ${ms.toFixed(0).padStart(5)}ms  ${r.rows.length} rows  ${label}`);
}

async function main() {
  console.log("Workspace      | listCustomers (new shape)");
  console.log("---------------+---------------------------");

  // Warm the connection so the first sample isn't a cold-start outlier.
  await client.execute("SELECT 1");

  const workspaces = [
    { id: "wks_bloom_beauty", name: "Bloom Beauty" },
  ];
  // Discover Pronto + Simplesat ids dynamically (random per seed).
  const rest = await client.execute(
    "SELECT id, name FROM workspaces WHERE id != 'wks_bloom_beauty' ORDER BY name",
  );
  for (const r of rest.rows) {
    workspaces.push({ id: String(r.id), name: String(r.name) });
  }

  for (const ws of workspaces) {
    console.log(`\n${ws.name}:`);
    // Three samples to see consistency.
    await time("sample 1", NEW_LIST_CUSTOMERS_SQL, [ws.id, ws.id, ws.id]);
    await time("sample 2", NEW_LIST_CUSTOMERS_SQL, [ws.id, ws.id, ws.id]);
    await time("sample 3", NEW_LIST_CUSTOMERS_SQL, [ws.id, ws.id, ws.id]);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
