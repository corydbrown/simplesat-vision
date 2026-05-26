# SVP-162 — Perf diagnosis

**TL;DR:** It is **not** a region-mismatch problem. It is the **list queries themselves** doing 60–90s of SQL work per request, dominated by **correlated subqueries fanning out over 50,000 tickets**. `/customers` on Bloom Beauty is a single query that does 3 correlated subqueries × 1,200 customers and takes **87 seconds** end-to-end. `/tickets` does 8 correlated subqueries × 50 rows and takes 18 seconds. The fix is query reshape (GROUP BY in derived tables), not architecture, not infra.

## Measurements (Turso us-east-1, from Bangkok)

Baseline RTT to Turso: 265–340ms warm (one-way × 2). First connection: 2.3s.

| Page | Bloom Beauty | Pronto | Simplesat |
|---|---|---|---|
| `/customers` (1 query, 3 correlated subqueries) | **87,593 ms** | 271 ms | 277 ms |
| `/tickets` (select+count parallel; 8 sig subqueries) | **17,972 ms** | 799 ms | 283 ms |
| `/coaching` (select+count parallel; 1 autofail subquery) | 2,411 ms | 290 ms | 271 ms |
| Layout (`PrimaryNav`: 2 queries) | 571 ms | 565 ms | 569 ms |
| `ViewsProvider` (5 sequential server actions) | 1,383 ms | 1,394 ms | 1,377 ms |

Bloom row counts (the smoking gun on scale):

| Table | Count |
|---|---|
| customers | 1,200 |
| tickets | 50,000 |
| ticket_events | 18,946 |
| responses | 13,664 |
| ticket_messages | 3,498 |
| evaluations | 495 |

Pronto and Simplesat each have **0** customers / tickets / responses — that's why their pages look fast. The performance cliff is data volume, not workspace identity. **Any workspace with Bloom-scale data will look the same.**

## Root cause #1 — `/customers`: 1,200 × 3 correlated subqueries = 87s

```sql
SELECT customers.*,
  (SELECT COUNT(*) FROM tickets WHERE tickets.customer_id = customers.id)         AS total_tickets,
  (SELECT AVG(CAST(rating AS REAL)) FROM responses WHERE responses.customer_id = customers.id) AS avg_rating,
  (SELECT MAX(tickets.created_at) FROM tickets WHERE tickets.customer_id = customers.id)        AS last_seen
FROM customers
WHERE customers.workspace_id = ?
ORDER BY last_seen DESC
```

`EXPLAIN QUERY PLAN` confirms the inner subqueries use the right indexes (`tickets_customer_id_idx`, `responses_customer_id_idx`). The indexes are not the problem — it's that we're seeking 3 indexes for every one of 1,200 customers = **3,600 index seeks per request**, plus a `TEMP B-TREE FOR ORDER BY` because the ORDER BY column is a subquery result. None of it is cacheable across customers because each subquery filters by the outer `customer_id`.

**The fix is reshape.** Move the three subqueries into derived tables joined once:

```sql
SELECT c.*,
  COALESCE(t.total_tickets, 0) AS total_tickets,
  r.avg_rating,
  t.last_seen
FROM customers c
LEFT JOIN (
  SELECT customer_id, COUNT(*) AS total_tickets, MAX(created_at) AS last_seen
  FROM tickets
  WHERE workspace_id = ?
  GROUP BY customer_id
) t ON t.customer_id = c.id
LEFT JOIN (
  SELECT customer_id, AVG(CAST(rating AS REAL)) AS avg_rating
  FROM responses
  WHERE workspace_id = ?     -- (see follow-up: responses needs workspace_id scope, see #4 below)
  GROUP BY customer_id
) r ON r.customer_id = c.id
WHERE c.workspace_id = ?
ORDER BY t.last_seen DESC
```

This computes each aggregate **once per customer**, not three times, and lets SQLite stream the result rather than nest-loop it. Expected gain: 50–100× on Bloom (sub-second).

Same fix shape applies to `getCustomerById` stats (currently 4 correlated subqueries), but its impact is per-detail-page, not per-list — lower priority.

## Root cause #2 — `/tickets`: 50 × 8 correlated subqueries = 18s

`listTickets` issues 8 signal expressions per row, each a correlated scalar subquery into `ticket_events` or `ticket_messages` (see [src/lib/filters/fields/tickets.ts](src/lib/filters/fields/tickets.ts)). For 50 rows that's 400 subqueries per request. The signals are essential to the table — we can't drop them — but we can compute them in **two GROUP BY passes** scoped to the visible page:

```sql
WITH page AS (
  SELECT id, ... FROM tickets
  WHERE workspace_id = ?
  ORDER BY ...
  LIMIT 50 OFFSET 0
)
SELECT p.*,
  ev.had_transfer, ev.reassignment_count, ev.sla_breached, ev.escalated, ev.ai_handoff,
  msg.customer_reply_count, msg.queue_wait_hours, msg.longest_idle_hours
FROM page p
LEFT JOIN (
  SELECT ticket_id,
    MAX(CASE WHEN verb='assignee_changed' AND previous_value IS NOT NULL THEN 1 ELSE 0 END) AS had_transfer,
    SUM(CASE WHEN verb='assignee_changed' AND previous_value IS NOT NULL THEN 1 ELSE 0 END) AS reassignment_count,
    MAX(CASE WHEN verb='sla_breached' THEN 1 ELSE 0 END) AS sla_breached,
    MAX(CASE WHEN verb='escalated'    THEN 1 ELSE 0 END) AS escalated,
    MAX(CASE WHEN verb='ai_handoff'   THEN 1 ELSE 0 END) AS ai_handoff
  FROM ticket_events
  WHERE ticket_id IN (SELECT id FROM page)
  GROUP BY ticket_id
) ev ON ev.ticket_id = p.id
LEFT JOIN (
  ... similar for ticket_messages: customer_reply_count, queue_wait_hours, longest_idle_hours
) msg ON msg.ticket_id = p.id
```

The CTE narrows event/message scans to the 50 visible tickets, then a single GROUP BY computes all the signals per ticket. Expected: 18s → ~1s.

`longest_idle_hours` is the gnarliest — it uses `LAG()` over a UNION of messages+events. It can stay correlated for the 50-row page or move into the WITH chain; either is fine, the cost will be on 50 tickets not 50,000.

The same reshape applies to `getTicketById` (single-row, lower impact) and `listTicketsForCustomer` / `listTicketsForTeamMember` (drawer tables).

## Root cause #3 (smaller, batchable) — `ViewsProvider`: 5 sequential round trips

After first paint, the client fires 5 `listSavedViews` server actions sequentially (one per entity). Each is one round trip × 280ms = ~1.4s on this connection. On Vercel→Turso same-region this drops to ~25ms total, so on the deployed pilot **this is not load-bearing for the 60s figure** — but it is a free win.

Fix: replace the 5 actions with one `listSavedViewsByEntities(entities)` server action that does:

```sql
SELECT * FROM saved_views
WHERE workspace_id = ? AND entity IN ('tickets','customers','responses','team-members','coaching')
ORDER BY entity, position ASC, created_at ASC
```

…then group on the client. One trip instead of five.

## Region / infra hypotheses — likely a non-issue

- The brief floated Vercel/Turso region mismatch. I can't access the Vercel dashboards (per STOP_CONDITIONS), but the data points to query cost, not network cost. Even if Vercel is in the **same** region as Turso (~5ms RTT), the 87s query stays 80s+ because >99% of the time is SQL execution, not transit.
- **However:** please still confirm Turso primary region (Turso dashboard) and Vercel function region (Project Settings → Functions). If they're not co-located, that's a free improvement on top of the query fix.
- `getSidebarCounts` in [src/db/queries/counts.ts](src/db/queries/counts.ts) is **dead code** — exported, called nowhere. The brief flagged "combine sidebar counts" as a likely fix; it would have helped if the function were used, but it isn't.

## Win confirmed for `/customers` (2026-05-26)

After the reshape + migration 0013 (composite indexes on `tickets(workspace_id, customer_id, created_at)` and `responses(workspace_id, customer_id, rating)`):

| Workspace | Before | Reshape only | + composite indexes |
|---|---|---|---|
| Bloom (1.2k customers, 50k tickets) | 87.6 s | 36-50 s | **6.2-8.1 s** (Bangkok→US transit-bound) |
| Pronto, Simplesat (empty) | ~280 ms | ~280 ms | ~280 ms |

`EXPLAIN QUERY PLAN` confirms both composites are read as `USING COVERING INDEX`. The remaining 6-8s on this connection is libsql buffering the sorted result over Bangkok WAN (~270ms RTT, ~30KB/s effective TCP); the same query from Vercel us-east-1 → Turso us-east-1 projects to **~1-2 s** end to end, well inside the 2 s p50 target.

## Win confirmed for `/tickets` (2026-05-26)

For `/tickets` the diagnosis from earlier (8 correlated signal subqueries × 50 rows = 400 lookups) turned out to be only half the story. The real bottleneck on Bloom was the **query plan**: SQLite picked `tickets_workspace_id_idx` for WHERE, then did `TEMP B-TREE FOR ORDER BY`, which forced subquery evaluation across all 50K workspace tickets before the LIMIT 50 could apply.

Two-part fix, no code change (the existing query is fine once the indexes are right):

1. **Migration 0014** — covering composites for each signal subquery:
   - `ticket_events(ticket_id, verb, previous_value)` — covers had_transfer / reassignment_count / sla_breached / escalated / ai_handoff
   - `ticket_messages(ticket_id, author_role, created_at)` — covers customer_reply_count / queue_wait_hours
   - `evaluations(ticket_id, scored_at)` — covers qa_score / qa_status (latest-per-ticket)
2. **Migration 0015** — `tickets(workspace_id, closed_at)` so the default ORDER BY closed_at DESC LIMIT 50 pushes into the index scan; SQLite reads in reverse-DESC order and stops after 50 matches without ever evaluating subqueries on the other 49,950 rows.

| Workspace | Before | After 0014 only | After 0014 + 0015 |
|---|---|---|---|
| Bloom (50k tickets, 19k events, 14k responses) | 17,972 ms | 11.5-17.9 s | **1.4-2.1 s** (Bangkok→US) |
| Pronto / Simplesat (empty) | ~280 ms | ~280 ms | ~280 ms |

`EXPLAIN QUERY PLAN` after 0015 confirms `SEARCH tickets USING INDEX tickets_workspace_closed_at_idx` with no TEMP B-TREE. Each inner subquery uses its new covering composite (`ticket_events_ticket_verb_prev_idx`, etc.) The 1.4-2.1 s on Bangkok→US is transit-bound — same protocol overhead as the customers case; projected production time is **sub-second**.

### Failed approach (kept here for posterity / DECISIONS.md candidate)

I first tried reshaping listTickets the same way as listCustomers — pulling the 8 signal subqueries into workspace-wide aggregate subqueries (events_agg, messages_agg, evals_agg, longest_idle_agg) joined once per ticket. **That made Bloom 18 s → 42 s**, because the aggregates pre-materialize across all 19k events + 3.5k messages + 22k timeline rows for every request, dwarfing the original "50 × correlated × subquery" cost. The original correlated shape is actually a good fit *for paginated reads* when the per-row subquery is index-only and the outer LIMIT pushes down — which is what migrations 0014 + 0015 unlock. Reshape only beats correlated when the outer set is small (e.g. listCustomers with 1,200 rows where pagination doesn't apply); for paginated lists at scale, keep the correlated shape and invest in covering indexes.

## Recommended fix sequence (smallest-blast first)

1. **Reshape `listCustomers`** (root cause #1). One file, expected 50–100× win on Bloom. Verify with the `perf-profile.ts` script.
2. **Reshape `listTickets`** (root cause #2). Same pattern, more correlated subqueries. Same script verifies.
3. **Batch `ViewsProvider`** hydration into one server action (root cause #3). Free win, removes 4 round trips post-paint.
4. **Repeat the reshape on the drawer tables** (`listTicketsForCustomer`, `listResponsesForCustomer`, etc.) once the list-page pattern lands. Less critical for the 60s number but same bug shape.
5. **(Punt for now)** Indexes look correct already. No new index needed for the listCustomers reshape. The listTickets reshape might benefit from `(ticket_id, verb)` composite indexes on `ticket_events` / `ticket_messages`; verify after the reshape — don't pre-index.

## Follow-up #4 — schema (CORRECTION, 2026-05-26)

Earlier draft of this doc claimed `responses` lacked `workspace_id`. **That was wrong** — the column was added by migration 0012 (NOT NULL, indexed) and is reflected in [src/db/schema.ts](src/db/schema.ts) at the `responses` table definition. No migration needed. The reshape can filter `responses.workspace_id = ?` directly.

The mistake came from inferring the schema from the production SQL (which doesn't reference responses.workspace_id) rather than reading the schema file. Lesson logged.

## Instrumentation kept on branch (env-gated)

- [src/db/client.ts](src/db/client.ts) — added `SIMPLESAT_QUERY_LOG=1` wrapper that prints every libsql `execute` / `batch` with duration + sql preview. Off by default, can stay in the codebase as a debug toggle.
- [scripts/perf-profile.ts](scripts/perf-profile.ts) — repeatable benchmark harness. Re-run after each fix to confirm the win.
- [scripts/perf-counts.ts](scripts/perf-counts.ts) — row-count + EXPLAIN QUERY PLAN check.

Run via `set -a && source .env.local && set +a && npx tsx scripts/perf-profile.ts`.
