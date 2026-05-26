import { createClient } from "@libsql/client";
const c = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function n(sql: string) {
  const t0 = performance.now();
  const r = await c.execute(sql);
  console.log(
    `${(performance.now() - t0).toFixed(0).padStart(5)}ms  ${String(r.rows[0].n).padStart(8)}  ${sql.replace(/\s+/g, " ").slice(0, 90)}`,
  );
}

async function main() {
  const wid = "wks_bloom_beauty";
  await n(`SELECT COUNT(*) AS n FROM customers WHERE workspace_id = '${wid}'`);
  await n(`SELECT COUNT(*) AS n FROM tickets WHERE workspace_id = '${wid}'`);
  await n(
    `SELECT COUNT(*) AS n FROM ticket_messages tm JOIN tickets t ON t.id=tm.ticket_id WHERE t.workspace_id = '${wid}'`,
  );
  await n(
    `SELECT COUNT(*) AS n FROM ticket_events te JOIN tickets t ON t.id=te.ticket_id WHERE t.workspace_id = '${wid}'`,
  );
  await n(
    `SELECT COUNT(*) AS n FROM responses r JOIN tickets t ON t.id=r.ticket_id WHERE t.workspace_id = '${wid}'`,
  );
  await n(`SELECT COUNT(*) AS n FROM evaluations WHERE workspace_id = '${wid}'`);
  // Index check on responses(customer_id):
  await n(
    `SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND tbl_name='responses' AND sql LIKE '%customer_id%'`,
  );
  await n(
    `SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND tbl_name='tickets' AND sql LIKE '%customer_id%'`,
  );

  // EXPLAIN QUERY PLAN on the slow listCustomers shape.
  console.log("\nEXPLAIN QUERY PLAN — listCustomers (Bloom):");
  const ep = await c.execute(`EXPLAIN QUERY PLAN
    SELECT customers.id,
      (SELECT COUNT(*) FROM tickets WHERE tickets.customer_id = customers.id) AS total_tickets,
      (SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.customer_id = customers.id) AS avg_rating,
      (SELECT MAX(tickets.created_at) FROM tickets WHERE tickets.customer_id = customers.id) AS last_seen
    FROM customers
    WHERE customers.workspace_id = '${wid}'
    ORDER BY last_seen DESC`);
  for (const r of ep.rows) {
    console.log(`  ${JSON.stringify(r)}`);
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
