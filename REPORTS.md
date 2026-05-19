# Reports

A clean, drag-and-drop pivot table editor over the four base entities. URL-shareable, dnd-kit-driven, server-aggregated.

## Status

Shipped:

- Pivot builder at `/reports` with Rows / Columns / Values / Filters axes
- Constraints: max **2 rows**, **1 column**, **3 values**, unlimited filters
- Base entity dropdown in the toolbar (Responses · Customers · Team members · Tickets); default **Responses**
- Property rail grouped by source entity per base (see `GROUP_ORDER` in `src/lib/reports/pivot-fields.ts`)
- Drag-and-drop (with `DragOverlay` chip following the cursor) + click-to-add
- Date bucketing (day / week / month / quarter / year)
- Numeric aggregations (count / sum / avg / min / max), filtered to a property's valid set
- Filters: enum checkbox lists, numeric `≤ value`, "has value" for strings/dates/relations
- Inline single-row axis layout with vertical dividers
- 2-row pivots merge the first axis label vertically (rowSpan) so each group reads as one
- Pivot table: sticky column headers, sticky row labels, sticky totals footer, max-height with internal scroll, horizontal scroll only when content overflows
- Reset button, AlertDialog confirm when switching base, AI prompt button (stub today)
- URL state: `?r=<base64(JSON)>` — shareable; localStorage holds only the rail width
- "New report" item under the Reports section in the primary nav
- **AI prompt → real Anthropic call** (Haiku 4.5, forced tool use, system prompt cached per base). See "AI build-with-prompt" below
- **Multi-metric value model** — CSAT, CES, NPS each exposed as first-class pivot values (`csat_avg`, `ces_avg`, `ces_positive_pct`, `nps_score`). See "Metric-typed values" below

Not built yet:

- Save / load / list page
- Drill-down: click a cell → drawer with the underlying records, prefiltered
- Chart visualizations (bar / line / pie) — Recharts is installed but not wired
- Insight blocks on `/reports`
- CSV export
- Sort pivot by a value column (e.g., highest count first)
- Conditional cell formatting (low ratings tinted red, high green)
- Drag chips between axes / reorder within an axis
- **Topic as a row/column axis.** `responses.topics` is a JSON array, so axis-ifying requires a `CROSS JOIN json_each(topics)` pattern that changes row cardinality (one row per (response, topic) pair). The current compiler is structured around stable "one row per base entity" semantics — adding a fanout join needs care so values like `csat_avg` don't double-count when a response has multiple topics. Tracked, deferred.

## Architecture

```
src/lib/reports/
  types.ts                  ReportConfig, AxisField, ValueDef, FilterDef, BaseEntity
  pivot-fields.ts           per-base field registry + JOIN helpers + GROUP_ORDER + bucketSql
  compile.ts                ReportConfig -> Drizzle SQL (sql.raw fragments + parameterized values)
  pivot.ts                  pure cross-tab: flat rows -> 2D grid with totals
  url-state.ts              base64 JSON <-> ?r=
  format.ts                 formatPivotValue, valueLabel
  actions.ts                'use server': runReportAction, buildReportFromPrompt (stub)

src/db/queries/reports.ts   runReport(config) -> ReportResult (serializable for client)

src/components/reports/
  report-builder.tsx        client orchestrator: state, DnD context, URL sync, debounced fetch
  base-entity-dropdown.tsx  toolbar dropdown ("Pivot over Responses ▾")
  property-rail.tsx         left rail, draggable chips grouped by entity
  inline-axis.tsx           single drop target for one axis (one row of the inline strip)
  axis-zone.tsx             AddFieldButton + searchable popover (entity-grouped)
  axis-chip.tsx             chip with bucket/aggregation menu + remove
  filter-add.tsx            two-step filter picker (field -> op/value)
  filter-chips.tsx          rendered filter chip
  pivot-table.tsx           cross-tab renderer with sticky headers + rowspan grouping
  pivot-empty-state.tsx     "Add a value to begin" / "Drag a property" placeholder
  ai-prompt-dialog.tsx      modal: button -> Dialog -> server action -> apply config
  field-icon.tsx            Lucide icon per dataType (string/number/date/enum/relation)

src/app/(workspace)/reports/
  layout.tsx                force-dynamic pass-through
  page.tsx                  Topbar + ReportBuilder; reads ?r=
  loading.tsx               TableSkeleton
```

### Data model

```ts
type ReportConfig = {
  base: "ticket" | "customer" | "team_member" | "response";
  rows: AxisField[];                  // length 0..2
  columns: AxisField[];               // length 0..1
  values: ValueDef[];                 // length 0..3 (0 allowed; empty state shows)
  filters: FilterDef[];
};

type AxisField = { propertyId: string; bucket?: DateBucket };
type ValueDef  = { propertyId: string; agg: Aggregation; label?: string };  // "*" + count = "Records"
type FilterDef = { propertyId: string; op: FilterOp; value?: unknown };
```

### Compiler safety

`compile.ts` only references SQL via `PIVOT_FIELDS[base]`. User values from filters become bound parameters via Drizzle's `sql\`...${value}...\`` template. No raw user input is ever spliced into SQL. `valueOnly: true` fields (correlated subqueries) are forbidden from rows/columns at both the UI and compile layers.

### Property entity grouping

Per `GROUP_ORDER` in `pivot-fields.ts`:

| Base | Groups (rail order) |
|---|---|
| Responses | Metrics · Response · Customer · Team member · Ticket |
| Tickets | Ticket · Customer · Assignee · Response · Metrics |
| Customers | Customer · Activity · Metrics |
| Team members | Team member · Activity · Metrics |

"Assignee" on the ticket base intentionally differs from "Team member" — assignee is the Simplesat-facing ticket attribute; "Team member" is the canonical entity (used on the responses base when the team member handled the response). Both point to the same `team_members` table but frame the relation differently.

## AI build-with-prompt

Wired in `src/lib/reports/actions.ts → buildReportFromPrompt`. The dialog at `src/components/reports/ai-prompt-dialog.tsx` collects a free-text prompt, the server action calls Claude, the returned `ReportConfig` flows through the same `setConfig` path as drag-and-drop edits.

### Implementation

- **Model**: `claude-haiku-4-5` (fast, cheap, enough for structured tool use over ~25 fields). Bump to `claude-sonnet-4-6` if accuracy regresses.
- **Tool use**: single `build_report` tool whose `input_schema` mirrors `ReportConfig` (enums for `agg`/`bucket`/`op`, maxItems for the axes). `tool_choice: { type: "tool", name: "build_report" }` forces structured output — no JSON parsing.
- **System prompt**: built per-base from `PIVOT_FIELDS[base]`. Includes the ReportConfig shape, hard constraints (`valueOnly` only in values/filters, the axis caps), metric-picker heuristics ("CSAT → csat_avg", "NPS → nps_score"), sentiment/quality filter heuristics ("low CSAT" → survey_type=csat + rating ≤ 2), axis discipline ("no date axis unless time is named", "top/best → no columns").
- **Prompt caching**: system block carries `cache_control: { type: "ephemeral" }`. Each base's system prompt is stable across calls, so cache hits accrue per base. If the prompt drops under the model's ~4096-token caching minimum, caching silently no-ops.
- **Validation**: `sanitize(base, candidate)` walks the model output and drops anything inconsistent — unknown propertyIds, `valueOnly` fields in rows/columns, ops not in the field's `filterOps`, aggs not in the field's `aggregations`. Clamps axis lengths; falls back to `defaultConfig(base)` if everything got stripped.
- **Errors**: API failures bubble to the dialog, which renders an inline `text-destructive` line ("Couldn't build that. Try rephrasing.") and keeps the prompt populated.

### Compile-time defense (load-bearing)

`compile.ts` independently enforces `field.filterOps.includes(filter.op)` and drops anything else. This protects against stale `?r=` URLs, hand-edited state, or any future model that ignores the prompt — bad filters never reach SQL.

### Reference prompts (regression net)

- "Avg CSAT by team member by month" → response · rows:[team_member], columns:[responded_at month], values:[csat_avg]
- "Tickets by channel by status" → ticket · rows:[channel], columns:[status], values:[count]
- "Detractor rate by tier" → response · rows:[tier], values:[count], filters:[survey_type=csat, rating ≤ 2]
- "Top customers by ticket volume" → customer · rows:[company], values:[total_tickets sum]
- "Companies with low CSAT score by quarter" → response · rows:[company], columns:[responded_at quarter], filters:[survey_type=csat, rating ≤ 2]
- "Top performing team members" → response · rows:[team_member], values:[csat_avg] (no date axis; sort-by-value is a known gap)

## Metric-typed values

Survey responses span four metric types — CSAT (1–5), CES (1–5, optionally % positive), 5-Star (1–5, future), NPS (0–10, %P − %D). Averaging raw `rating` across types is meaningless and NPS isn't an average at all. The pivot exposes each metric as its own first-class **value** instead of routing through a global metric selector.

| Value id | Formula |
|---|---|
| `csat_avg` | `AVG(rating) FILTER (survey_type='csat')` |
| `ces_avg` | `AVG(rating) FILTER (survey_type='ces')` |
| `ces_positive_pct` | `100.0 × count(rating≥4) / count(*) FILTER (survey_type='ces')` (top-2-box per Simplesat convention) |
| `nps_score` | `100.0 × (count(rating≥9) − count(rating≤6)) / count(*) FILTER (survey_type='nps')` |
| `five_star_avg` | `AVG(rating) FILTER (survey_type='five_star')` |

All five are `valueOnly: true` and live in the `Metrics` rail group. On the response base they're emitted as direct `AVG/SUM CASE WHEN …` expressions; on the customer / team_member / ticket bases they're correlated subqueries (`(SELECT … FROM responses WHERE customer_id = …)`). The correlated form is also row-level filterable (`csat_avg < 3` on the customer base ⇒ `WHERE (SELECT AVG(…)) < 3` — valid SQLite); the direct form is not (aggregates can't appear in WHERE) and has `filterOps: []`.

The compiler uses `field.valueExpr` verbatim when present, so the pre-aggregated formula bypasses the standard `aggExpr` switch. The user's chosen aggregation on these fields is ignored at compile time — the metric encodes its own math.

### 5-Star

Added in phase 7. `five_star_avg` mirrors CSAT: direct aggregate on the response base (`filterOps: []`), correlated subquery on customer / team_member / ticket bases (`filterOps: NUMERIC_OPS`). Seed distributes 5-Star at 8% of responses via the "Onboarding 5-Star" web-embed survey.

## Future phases (referenced but not started)

- **Save / load**: a `reports` SQLite table with `id`, `name`, `base_entity`, `config (JSON)`, `created_at`. Sidebar nav lists saved reports under "New report". Star/favorite via a column.
- **Drill-down**: cell click → drawer (`?drawer=…`) with the underlying records, prefiltered to that row+col coordinate.
- **Charts**: bar / line / pie via Recharts. Same data shape feeds both pivot table and chart.
- **Insight blocks**: AI-driven summaries on the `/reports` home (currently the builder is `/reports` directly; would shift the builder to `/reports/new`).
