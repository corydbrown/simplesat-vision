import { createClient } from "@libsql/client";

const c = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const wid = "wks_bloom_beauty";
  const sql = `
    EXPLAIN QUERY PLAN
    SELECT
      customers.id, customers.name, customers.email,
      COALESCE(t_agg.total_tickets, 0) AS total_tickets,
      r_agg.avg_rating AS avg_rating,
      t_agg.last_seen AS last_seen
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
  const r = await c.execute({ sql, args: [wid, wid, wid] });
  for (const row of r.rows) console.log("  ", JSON.stringify(row));

  console.log("\n--- Variant: drop ORDER BY to see if sort is the cost ---");
  const sql2 = sql.replace("ORDER BY last_seen DESC", "");
  // Time it
  const t0 = performance.now();
  const r2 = await c.execute({
    sql: sql2.replace("EXPLAIN QUERY PLAN\n    ", ""),
    args: [wid, wid, wid],
  });
  console.log(`  ${(performance.now() - t0).toFixed(0)}ms ${r2.rows.length} rows (no ORDER BY)`);

  console.log("\n--- Variant: just the t_agg subquery in isolation ---");
  const t1 = performance.now();
  const r3 = await c.execute({
    sql: `SELECT customer_id, COUNT(*) AS n, MAX(created_at) AS ls FROM tickets WHERE workspace_id = ? GROUP BY customer_id`,
    args: [wid],
  });
  console.log(`  ${(performance.now() - t1).toFixed(0)}ms ${r3.rows.length} rows (t_agg alone)`);

  console.log("\n--- Variant: just the r_agg subquery in isolation ---");
  const t2 = performance.now();
  const r4 = await c.execute({
    sql: `SELECT customer_id, AVG(CAST(rating AS REAL)) AS ar FROM responses WHERE workspace_id = ? GROUP BY customer_id`,
    args: [wid],
  });
  console.log(`  ${(performance.now() - t2).toFixed(0)}ms ${r4.rows.length} rows (r_agg alone)`);

  console.log("\n--- Variant: customers scan alone ---");
  const t3 = performance.now();
  const r5 = await c.execute({
    sql: `SELECT id, name, email FROM customers WHERE workspace_id = ?`,
    args: [wid],
  });
  console.log(`  ${(performance.now() - t3).toFixed(0)}ms ${r5.rows.length} rows (customers alone)`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
