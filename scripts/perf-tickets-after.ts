/**
 * SVP-162 — regression check for listTickets. The query shape is unchanged
 * (8 correlated signal subqueries); the perf win comes from migrations
 * 0014 + 0015 which add covering composite indexes for each signal
 * subquery AND a (workspace_id, closed_at) composite that lets SQLite
 * push the default ORDER BY closed_at DESC LIMIT 50 down into the index
 * scan instead of materializing all workspace rows then sorting.
 *
 * Re-run after any change to the signal subqueries or the default sort
 * to confirm the index plan still holds.
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set.");
  process.exit(1);
}
const client = createClient({ url, authToken });

const PAGE_SIZE = 50;

// Mirrors the SQL Drizzle currently emits for listTickets (default sort by
// closed_at DESC, no filters).
const LIST_SQL = `
  SELECT tickets.*,
    customers.id AS c_id, customers.name AS c_name, customers.company AS c_company,
    team_members.id AS tm_id, team_members.name AS tm_name,
    team_members.avatar_color AS tm_avatar_color, team_members.team AS tm_team,
    responses.id AS r_id, responses.rating AS r_rating,
    responses.scale AS r_scale, responses.comment AS r_comment,
    (SELECT overall_score FROM evaluations WHERE evaluations.ticket_id = tickets.id ORDER BY scored_at DESC LIMIT 1) AS qa_score,
    (SELECT status        FROM evaluations WHERE evaluations.ticket_id = tickets.id ORDER BY scored_at DESC LIMIT 1) AS qa_status,
    (SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'assignee_changed' AND ticket_events.previous_value IS NOT NULL)) AS had_transfer,
    (SELECT COUNT(*)        FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'assignee_changed' AND ticket_events.previous_value IS NOT NULL) AS reassignment_count,
    ((SELECT MIN(ticket_messages.created_at) FROM ticket_messages WHERE ticket_messages.ticket_id = tickets.id AND ticket_messages.author_role = 'agent') - tickets.created_at) / 3600000.0 AS queue_wait_hours,
    (SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'sla_breached')) AS sla_breached,
    (SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'escalated'))    AS escalated,
    (SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'ai_handoff'))   AS ai_handoff,
    (SELECT COUNT(*) FROM ticket_messages WHERE ticket_messages.ticket_id = tickets.id AND ticket_messages.author_role = 'customer') AS customer_reply_count,
    (SELECT MAX(gap_ms) / 3600000.0 FROM (
       SELECT created_at - LAG(created_at) OVER (ORDER BY created_at) AS gap_ms
         FROM (SELECT created_at FROM ticket_messages WHERE ticket_messages.ticket_id = tickets.id
               UNION ALL
               SELECT created_at FROM ticket_events   WHERE ticket_events.ticket_id   = tickets.id)
    )) AS longest_idle_hours
  FROM tickets
  LEFT JOIN customers    ON customers.id    = tickets.customer_id
  LEFT JOIN team_members ON team_members.id = tickets.assigned_team_member_id
  LEFT JOIN responses    ON responses.ticket_id = tickets.id
  WHERE tickets.workspace_id = ?
  ORDER BY tickets.closed_at DESC
  LIMIT ${PAGE_SIZE} OFFSET 0
`;

const COUNT_SQL = `SELECT COUNT(*) AS n FROM tickets WHERE workspace_id = ?`;

async function timeOne(label: string, sql: string, args: string[]) {
  const t0 = performance.now();
  const r = await client.execute({ sql, args });
  const ms = performance.now() - t0;
  console.log(`  ${ms.toFixed(0).padStart(5)}ms  ${r.rows.length} rows  ${label}`);
}

async function main() {
  await client.execute("SELECT 1"); // warm

  const wsRes = await client.execute("SELECT id, name FROM workspaces ORDER BY name");
  for (const ws of wsRes.rows) {
    const wid = String(ws.id);
    const name = String(ws.name);
    console.log(`\n${name}:`);
    const t0 = performance.now();
    const [list, count] = await Promise.all([
      client.execute({ sql: LIST_SQL, args: [wid] }),
      client.execute({ sql: COUNT_SQL, args: [wid] }),
    ]);
    const wall = performance.now() - t0;
    console.log(`  parallel wall: ${wall.toFixed(0)}ms (list ${list.rows.length} rows, count=${count.rows[0].n})`);
    await timeOne("list-only sample 2", LIST_SQL, [wid]);
    await timeOne("list-only sample 3", LIST_SQL, [wid]);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
