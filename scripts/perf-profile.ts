/**
 * SVP-162 diagnostic profiler. Runs the exact SQL the /customers, /tickets,
 * and /coaching pages issue against Turso, parameterized by workspace id.
 * Bypasses the Next/WorkOS auth path so we can measure raw DB round-trip cost
 * without setting up a browser session.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/perf-profile.ts
 *
 * Outputs per-workspace per-page totals + a baseline RTT.
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set. Run `set -a && source .env.local && set +a` first.");
  process.exit(1);
}

const client = createClient({ url, authToken });

type Timing = { label: string; ms: number; rowCount?: number };

async function timed<T extends { rows: unknown[] }>(
  label: string,
  fn: () => Promise<T>,
): Promise<Timing> {
  const t0 = performance.now();
  let rowCount = 0;
  try {
    const res = await fn();
    rowCount = res.rows.length;
  } catch (e) {
    const ms = performance.now() - t0;
    console.error(`  ! ${label} threw after ${ms.toFixed(0)}ms:`, e);
    return { label, ms, rowCount: -1 };
  }
  const ms = performance.now() - t0;
  return { label, ms, rowCount };
}

// ----- production SQL (mirrors src/db/queries/*) -----

const LIST_SAVED_VIEWS_SQL = `
  SELECT * FROM saved_views
  WHERE workspace_id = ? AND entity = ?
  ORDER BY position ASC, created_at ASC
`;

const LIST_WORKSPACES_FOR_USER_SQL = `
  SELECT w.id, w.name, w.slug, w.integration_type
  FROM user_workspaces uw
  INNER JOIN workspaces w ON uw.workspace_id = w.id
  WHERE uw.user_id = ?
  ORDER BY w.name ASC
`;

const GET_FIRST_USER_WORKSPACE_SQL = `
  SELECT workspace_id FROM user_workspaces
  WHERE user_id = ?
  ORDER BY created_at ASC
  LIMIT 1
`;

// listCustomers post-SVP-162 reshape: workspace-scoped t_agg / r_agg subqueries
// joined once per customer. See src/db/queries/customers.ts.
const LIST_CUSTOMERS_SQL = `
  SELECT
    customers.id, customers.name, customers.email, customers.company,
    customers.company_external_id, customers.company_domain, customers.language,
    customers.tier, customers.custom_properties,
    COALESCE(t_agg.total_tickets, 0) AS total_tickets,
    r_agg.avg_rating                  AS avg_rating,
    t_agg.last_seen                   AS last_seen
  FROM customers
  LEFT JOIN (
    SELECT customer_id, COUNT(*) AS total_tickets, MAX(created_at) AS last_seen
    FROM tickets WHERE workspace_id = ? GROUP BY customer_id
  ) t_agg ON t_agg.customer_id = customers.id
  LEFT JOIN (
    SELECT customer_id, AVG(CAST(rating AS REAL)) AS avg_rating
    FROM responses WHERE workspace_id = ? GROUP BY customer_id
  ) r_agg ON r_agg.customer_id = customers.id
  WHERE customers.workspace_id = ?
  ORDER BY last_seen DESC
`;

// listTickets is a SELECT (with 8 signal correlated subqueries + 3 joins) +
// COUNT, run in parallel via Promise.all. We mirror that here.
const LIST_TICKETS_SELECT_SQL = `
  SELECT
    tickets.*,
    customers.id  AS c_id,  customers.name AS c_name, customers.company AS c_company,
    team_members.id AS tm_id, team_members.name AS tm_name,
    team_members.avatar_color AS tm_avatar_color, team_members.team AS tm_team,
    responses.id AS r_id, responses.rating AS r_rating,
    responses.scale AS r_scale, responses.comment AS r_comment,
    (SELECT overall_score FROM evaluations WHERE evaluations.ticket_id = tickets.id ORDER BY scored_at DESC LIMIT 1) AS qa_score,
    (SELECT status FROM evaluations WHERE evaluations.ticket_id = tickets.id ORDER BY scored_at DESC LIMIT 1) AS qa_status,
    (SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'assignee_changed' AND ticket_events.previous_value IS NOT NULL)) AS had_transfer,
    (SELECT COUNT(*)        FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'assignee_changed' AND ticket_events.previous_value IS NOT NULL) AS reassignment_count,
    ((SELECT MIN(ticket_messages.created_at) FROM ticket_messages WHERE ticket_messages.ticket_id = tickets.id AND ticket_messages.author_role = 'agent') - tickets.created_at) / 3600000.0 AS queue_wait_hours,
    (SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'sla_breached')) AS sla_breached,
    (SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'escalated')) AS escalated,
    (SELECT EXISTS(SELECT 1 FROM ticket_events WHERE ticket_events.ticket_id = tickets.id AND ticket_events.verb = 'ai_handoff')) AS ai_handoff,
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
  LIMIT 50 OFFSET 0
`;

const COUNT_TICKETS_SQL = `SELECT COUNT(*) AS n FROM tickets WHERE workspace_id = ?`;

const LIST_EVALUATIONS_SELECT_SQL = `
  SELECT
    evaluations.*,
    team_members.id AS tm_id, team_members.name AS tm_name,
    team_members.avatar_color AS tm_avatar_color, team_members.team AS tm_team,
    scorecards.id AS sc_id, scorecards.name AS sc_name,
    tickets.id AS t_id, tickets.subject AS t_subject,
    tickets.helpdesk_external_id AS t_helpdesk_external_id,
    (SELECT EXISTS(
       SELECT 1
         FROM evaluation_category_scores
         INNER JOIN scorecard_categories
           ON scorecard_categories.id = evaluation_category_scores.category_id
        WHERE evaluation_category_scores.evaluation_id = evaluations.id
          AND scorecard_categories.is_autofail = 1
          AND evaluation_category_scores.effective_score = 0
    )) AS auto_failed
  FROM evaluations
  LEFT JOIN team_members ON team_members.id = evaluations.scored_team_member_id
  LEFT JOIN scorecards   ON scorecards.id   = evaluations.scorecard_id
  LEFT JOIN tickets      ON tickets.id      = evaluations.ticket_id
  WHERE evaluations.workspace_id = ?
  ORDER BY evaluations.scored_at DESC
  LIMIT 50 OFFSET 0
`;

const COUNT_EVALUATIONS_SQL = `SELECT COUNT(*) AS n FROM evaluations WHERE workspace_id = ?`;

const ENTITIES = ["tickets", "customers", "responses", "team-members", "coaching"] as const;

// ----- profile run -----

async function profileWorkspace(name: string, workspaceId: string, userId: string) {
  console.log(`\n=== ${name} (workspace_id=${workspaceId}) ===`);

  const layoutTimings: Timing[] = [];

  // Workspace layout: PrimaryNav fires getCurrentUser + listWorkspacesForUser
  // (parallel). We measure the listWorkspacesForUser cost as a proxy — both
  // are 1 round trip each. getActiveWorkspaceId hits user_workspaces when no
  // cookie is present; we count it once for first-load worst case.
  layoutTimings.push(
    await timed("layout/listWorkspacesForUser", () =>
      client.execute({ sql: LIST_WORKSPACES_FOR_USER_SQL, args: [userId] }),
    ),
  );
  layoutTimings.push(
    await timed("layout/firstUserWorkspace", () =>
      client.execute({ sql: GET_FIRST_USER_WORKSPACE_SQL, args: [userId] }),
    ),
  );

  // ViewsProvider hydration: 5 server actions, each calls listSavedViews
  // sequentially. Today's UX is post-paint so it doesn't block FCP, but it
  // still costs 5 round trips before the saved-view sidebar is hydrated.
  const viewTimings: Timing[] = [];
  for (const entity of ENTITIES) {
    viewTimings.push(
      await timed(`views/${entity}`, () =>
        client.execute({ sql: LIST_SAVED_VIEWS_SQL, args: [workspaceId, entity] }),
      ),
    );
  }

  // Page queries. listTickets and listEvaluations run two queries in parallel
  // (list + count). listCustomers runs one query that returns all rows.
  console.log("\n  /customers:");
  const customersTiming = await timed("listCustomers", () =>
    client.execute({
      sql: LIST_CUSTOMERS_SQL,
      args: [workspaceId, workspaceId, workspaceId],
    }),
  );
  console.log(`    ${customersTiming.ms.toFixed(0)}ms (${customersTiming.rowCount} rows)`);

  console.log("\n  /tickets:");
  const ticketsParallel = await Promise.all([
    timed("listTickets/select", () =>
      client.execute({ sql: LIST_TICKETS_SELECT_SQL, args: [workspaceId] }),
    ),
    timed("listTickets/count", () =>
      client.execute({ sql: COUNT_TICKETS_SQL, args: [workspaceId] }),
    ),
  ]);
  ticketsParallel.forEach((t) =>
    console.log(`    ${t.ms.toFixed(0)}ms ${t.label}${t.rowCount != null ? ` (${t.rowCount} rows)` : ""}`),
  );
  const ticketsWallClock = Math.max(...ticketsParallel.map((t) => t.ms));

  console.log("\n  /coaching:");
  const coachingParallel = await Promise.all([
    timed("listEvaluations/select", () =>
      client.execute({ sql: LIST_EVALUATIONS_SELECT_SQL, args: [workspaceId] }),
    ),
    timed("listEvaluations/count", () =>
      client.execute({ sql: COUNT_EVALUATIONS_SQL, args: [workspaceId] }),
    ),
  ]);
  coachingParallel.forEach((t) =>
    console.log(`    ${t.ms.toFixed(0)}ms ${t.label}${t.rowCount != null ? ` (${t.rowCount} rows)` : ""}`),
  );
  const coachingWallClock = Math.max(...coachingParallel.map((t) => t.ms));

  console.log(`\n  Layout queries (PrimaryNav, sequential proxy):`);
  layoutTimings.forEach((t) =>
    console.log(`    ${t.ms.toFixed(0)}ms ${t.label} (${t.rowCount} rows)`),
  );
  const layoutSum = layoutTimings.reduce((a, b) => a + b.ms, 0);

  console.log(`\n  ViewsProvider hydration (5 server actions, sequential as fired):`);
  viewTimings.forEach((t) =>
    console.log(`    ${t.ms.toFixed(0)}ms ${t.label} (${t.rowCount} rows)`),
  );
  const viewsSum = viewTimings.reduce((a, b) => a + b.ms, 0);

  console.log(`\n  SUMMARY for ${name}`);
  console.log(`    layout (cumulative):       ${layoutSum.toFixed(0)}ms`);
  console.log(`    views hydration (5 calls): ${viewsSum.toFixed(0)}ms (would-be 1 batched call: ~${(viewsSum / 5).toFixed(0)}ms)`);
  console.log(`    /customers page query:     ${customersTiming.ms.toFixed(0)}ms`);
  console.log(`    /tickets page query:       ${ticketsWallClock.toFixed(0)}ms (wall clock; 2 parallel)`);
  console.log(`    /coaching page query:      ${coachingWallClock.toFixed(0)}ms (wall clock; 2 parallel)`);
}

async function baselineRtt() {
  const samples: number[] = [];
  // 10 sequential SELECT 1 to estimate one-way Vercel-region → Turso RTT.
  // First call may include connection setup so we discard it.
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await client.execute("SELECT 1");
    samples.push(performance.now() - t0);
  }
  const warm = samples.slice(1);
  const min = Math.min(...warm);
  const max = Math.max(...warm);
  const avg = warm.reduce((a, b) => a + b, 0) / warm.length;
  console.log(`Baseline RTT (SELECT 1, 9 warm samples): min=${min.toFixed(0)}ms avg=${avg.toFixed(0)}ms max=${max.toFixed(0)}ms`);
  console.log(`  (first sample, possibly cold: ${samples[0].toFixed(0)}ms)`);
}

async function main() {
  console.log(`Profiling against: ${url!.replace(/\/\/.*@/, "//<redacted>@")}`);
  await baselineRtt();

  // Find workspaces by name.
  const wsRes = await client.execute(
    "SELECT id, name FROM workspaces ORDER BY name",
  );
  const workspaces = wsRes.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
  }));
  console.log(`\nFound workspaces: ${workspaces.map((w) => w.name).join(", ")}`);

  // Use the first user as the "current user" — we just need a userId that
  // has rows in user_workspaces to make layout queries return non-empty.
  const userRes = await client.execute("SELECT id FROM users LIMIT 1");
  if (userRes.rows.length === 0) {
    console.error("No users in DB — cannot profile layout queries");
    process.exit(1);
  }
  const userId = String(userRes.rows[0].id);
  console.log(`Using user_id=${userId} for layout queries`);

  // Profile each workspace.
  for (const ws of workspaces) {
    await profileWorkspace(ws.name, ws.id, userId);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
