# Reports — phase 4 plan

This is the planning sketch for the Reports feature. Not built yet. Lives here so future iterations have a shared starting point.

## What it is

A user-friendly but powerful pivot table editor over all the seeded data. Slice and dice any entity by any property. Saveable as named Reports. Optional chart visualization.

The goal is to make the data this prototype already has feel *answerable* — questions like "how does CSAT trend by agent by month?" or "what's the detractor rate by tier?" should take 10 seconds, not a SQL query.

## Mental model

A **Report** is a query against one base entity (Tickets, Responses, Customers, Team Members), shaped by three axes plus filters:

- **Rows** — properties to group by, top-to-bottom
- **Columns** — properties to group by, left-to-right (true pivot)
- **Values** — aggregations to compute in each cell (count, sum, avg, min, max)
- **Filters** — predicates limiting the source rows (reuses the existing Views machinery in `src/lib/view-predicates.ts`)

Plus a viz mode: table (pivot grid), bar, line, or pie.

### Example reports

- **Avg CSAT by agent by month**
  base: Responses, rows: team_member, columns: month(responded_at), values: avg(rating)
- **Tickets by channel by status**
  base: Tickets, rows: channel, columns: status, values: count(*)
- **Detractor rate by customer tier**
  base: Responses, rows: customer.tier, values: count(rating<=2) / count(*) as percentage
- **Resolution time distribution by agent**
  base: Tickets (solved only), rows: agent, values: avg(solved_at - created_at), min, max, median
- **Survey-not-fired reasons over time**
  base: Tickets (survey_not_sent_reason IS NOT NULL), rows: reason, columns: week(created_at), values: count(*)

## Schema additions

```ts
reports
  id (PK, rpt_<nanoid>)
  name
  base_entity (enum: ticket | response | customer | team_member)
  config (JSON) — ReportConfig
  created_at, updated_at
```

Config shape:

```ts
type ReportConfig = {
  rows: AxisField[];
  columns: AxisField[];
  values: ValueDef[];
  filters: FilterDef[];
  viz: { type: "table" | "bar" | "line" | "pie" };
};

type AxisField = {
  propertyId: string;       // ref to a Property<T>.id from the registry
  bucket?: "day" | "week" | "month" | "quarter" | "year";  // for dates
};

type ValueDef = {
  propertyId: string;
  agg: "count" | "sum" | "avg" | "min" | "max";
  filter?: FilterDef;       // for things like "count where rating <= 2"
  label?: string;           // optional display label override
};

type FilterDef = {
  propertyId: string;
  op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not-in" | "isnull" | "notnull";
  value?: unknown;
};
```

## Architecture

### 1. Extend Property registry

Each `Property<T>` gains optional metadata so the builder UI can offer compatible operations per property:

```ts
type Property<T> = {
  ...existing fields...
  dataType?: "string" | "number" | "date" | "enum" | "boolean";
  aggregations?: ("count" | "sum" | "avg" | "min" | "max")[];
  bucketable?: boolean;   // dates only
  enumValues?: string[];  // for enum properties like status, channel
};
```

### 2. Compiler

`src/lib/reports/compile.ts` — pure function:

```ts
function compileReport(config: ReportConfig): SQLQuery
```

Translates a `ReportConfig` to a Drizzle query: `select().from(base).where(...).groupBy(...).having(...)`. Date bucketing via SQLite `strftime`. The compiler is the security-critical bit — it only references the property registry, never raw user input.

### 3. Builder UI

`/reports/[id]/edit` — drag-and-drop builder:

- Left rail: property list grouped by entity property groups (Identity / State / Relations / Source / Metadata / Activity / Survey)
- Three drop zones at top: Rows, Columns, Values
- Bottom: Filters chip area
- Right: live preview that re-runs on debounced config change

dnd-kit (already installed) drives the drag-and-drop. Each axis chip has a small overflow menu for bucket selection (dates), aggregation choice (values), and filter operators.

### 4. Renderer

- `<PivotTable>` for table viz — handles row groupings + column groupings; sticky row headers + sticky column headers, cell totals at right and bottom
- Recharts for bar / line / pie — same data shape feeds both

### 5. Persistence + sharing

- `/reports` list page (same shared shell)
- `/reports/[id]` detail / view-only mode (+ drawer)
- `/reports/[id]/edit` builder
- Star / favorite a report (a column on `reports`)
- No real auth, but a `created_by` column hardcoded for now in case it matters later

## Phasing for the build

- **4a**: Schema + minimal builder (Rows + Values + Filters only, no Columns axis, no charts). Get "Tickets by channel" end-to-end. Validates the compiler.
- **4b**: Add Columns axis. Add date bucketing. Validates that pivot output renders correctly with row + column headers.
- **4c**: Charts (bar, line, pie) and viz toggle.
- **4d**: Save / load / favorite. List page. Sharing UX.
- **4e** (stretch): Drill-down — clicking a cell opens a drawer with the underlying rows from the base entity, prefiltered.

## Open questions (worth a focused round before building)

- **Drill-down target**: drawer with a filtered EntityTable, or a new view on the entity's list page? (Lean: drawer, keeps it in-context.)
- **Cross-entity reports**: "tickets joined to responses joined to customers"? My recommendation is single base entity + denormalized fields on joins — simpler and matches how most analytics tools (Linear, Mixpanel) work.
- **Realtime vs cached**: are reports re-computed on each view, or cached with a TTL? For 50k rows the queries are fast; recompute on view is fine. Revisit if datasets grow.
- **Sharing scope**: reports private to a creator or workspace-wide? Workspace-wide is simpler for the prototype and matches no-auth state.
- **Calculated properties**: "responded within 24h" as a property? Power user feature. Defer.
- **Export**: CSV download of pivot data? Cheap to add. Probably yes in 4a.
- **Drill-down on charts**: clicking a bar opens the underlying rows. Same as cell drill-down. Decide together.

## Files (when phase 4 happens)

```
src/lib/reports/
  compile.ts                 # ReportConfig -> SQL
  types.ts                   # ReportConfig, AxisField, ValueDef, FilterDef
  property-aggregations.ts   # per-property metadata extension

src/db/queries/reports.ts    # list / get / save reports

src/components/reports/
  pivot-table.tsx
  axis-zone.tsx              # drag target
  property-source.tsx        # draggable property chip
  filter-chips.tsx

src/app/(workspace)/reports/
  layout.tsx                 # secondary nav with saved reports
  page.tsx                   # list of reports
  [id]/page.tsx              # view-only
  [id]/edit/page.tsx         # builder
  @drawer/...                # drill-down drawer
```
