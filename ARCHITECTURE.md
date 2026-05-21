# Architecture

The shape of the prototype and the load-bearing patterns that hold it together. Pairs with [CLAUDE.md](CLAUDE.md) (which carries the rules) and [REPORTS.md](REPORTS.md) (which covers the pivot editor in detail).

## File layout

```
┌──────────────────────────────────────────────────────┐
│ src/app/                                             │
│   (workspace)/                                       │
│     layout.tsx                  SidebarProvider +    │
│                                 PrimaryNav +         │
│                                 GlobalDrawer (once)  │
│     page.tsx                    home + insights      │
│     <entity>/                                        │
│       layout.tsx                pass-through only    │
│                                 (force-dynamic)      │
│       page.tsx                  list (EntityTable +  │
│                                 Topbar w/ crumbs)    │
│       [id]/page.tsx             full detail page     │
│                                 (Topbar w/ crumbs +  │
│                                 DetailActions slot)  │
│       loading.tsx               skeleton             │
│     reports/                                         │
│       page.tsx                  ReportBuilder        │
│       layout.tsx, loading.tsx                        │
│   api/                                               │
│     popover/<entity>/[id]/      hover-card payload   │
│     drawer/<entity>/[id]/       full drawer payload  │
│                                                      │
│ src/components/                                      │
│   shared/                       Everything reused    │
│     entity-table.tsx                                 │
│     entity-toolbar.tsx                               │
│     entity-pill.tsx                                  │
│     entity-popover.tsx                               │
│     property-list.tsx           <dl>-based primitive │
│     properties-panel.tsx        registry → list      │
│     detail-section.tsx          quiet section title  │
│     detail-actions.tsx          copy + kebab + ⌘L    │
│     detail-drawer.tsx           chrome only          │
│     global-drawer.tsx           URL-driven mount     │
│     filter-row.tsx              shared filter UI     │
│     list-filter-row.tsx         list-page wrapper    │
│     recent-page-tracker.tsx     palette recents      │
│     relation-tabs.tsx           pill-style tabs      │
│     open-in-table.tsx           escape hatch icon    │
│     columns-control.tsx                              │
│     layout-toggle.tsx                                │
│     stat-card.tsx, avg-rating.tsx                    │
│     tier-pill.tsx, team-pill.tsx                     │
│     star-rating.tsx, tag.tsx, avatar.tsx             │
│     table-skeleton.tsx                               │
│   shell/                        Nav + chrome         │
│     sidebar-context.tsx         width/collapsed/⌘\   │
│     primary-nav.tsx             server (data)        │
│     primary-nav-client.tsx      single-column nav    │
│     sidebar-toggle.tsx          topbar button        │
│     topbar.tsx                  crumbs + actions slot│
│     back-button.tsx             HistoryNav           │
│     search-palette.tsx          ⌘K palette           │
│   <entity>/                     Per-entity bodies +  │
│                                 entity-specific pills│
│   responses/                                         │
│     response-feed-card.tsx      feed-style card      │
│   surveys/                                           │
│     survey-detail.tsx           detail body (no list)│
│   tickets/                                           │
│     ticket-activity.tsx         chat-style timeline  │
│   reports/                      pivot builder        │
│     report-builder.tsx          orchestrator         │
│     pivot-table.tsx             cross-tab renderer   │
│     property-rail.tsx           draggable chips      │
│     inline-axis.tsx             4-axis drop strip    │
│     base-entity-dropdown.tsx                         │
│     axis-chip.tsx, axis-zone.tsx                     │
│     ai-prompt-dialog.tsx        button + modal       │
│     field-icon.tsx, pivot-empty-state.tsx            │
│   ui/                           shadcn (don't edit)  │
│                                                      │
│ src/db/                                              │
│   client.ts, schema.ts, seed.ts                      │
│   queries/                                           │
│     tickets.ts, customers.ts, team-members.ts,       │
│     responses.ts, surveys.ts, counts.ts,             │
│     insights.ts, reports.ts     runReport (pivot)    │
│   comments.json                 PII-scrubbed bank    │
│   ticket-messages.json          retail-voice bank    │
│                                                      │
│ src/lib/                                             │
│   topics.ts                     taxonomy + rollup    │
│   recent-pages.ts               palette recents      │
│   properties/                   Property registries  │
│     custom-fields.ts            custom-attr defs     │
│     custom-field-properties.tsx defs → Property<T>[] │
│   column-prefs.tsx              ColumnState context  │
│   view-predicates.ts            SQL where helpers    │
│   views.ts                      saved view defs      │
│   use-detail-hotkeys.ts         Esc / ⌘L / ⌘⏎       │
│   color-from-name.ts, format.ts, ids.ts              │
│   filters/                      shared filter system │
│     types.ts                    Filter, ops, labels  │
│     compile-list.ts             Filter[] -> Drizzle  │
│     url-state.ts                ?f= encode/decode    │
│     descriptor.ts, adapters.ts                       │
│     fields/<entity>.ts          server-only field map│
│     relation-cache.tsx          relation options     │
│     relative-range.ts           relative date ranges │
│   reports/                                           │
│     types.ts                    ReportConfig         │
│     pivot-fields.ts             SQL field registry   │
│     compile.ts                  Config -> SQL        │
│     pivot.ts                    flat rows -> grid    │
│     url-state.ts                ?r= encode/decode    │
│     actions.ts                  'use server' actions │
│     format.ts                                        │
└──────────────────────────────────────────────────────┘
```

## Core abstractions (in order of importance)

### Property registry (`src/lib/properties/<entity>.tsx`)

Single source of truth for how an entity's fields render. Powers:

- **List view**: EntityTable looks up `property.cell(row)` per row per visible column
- **Detail view**: PropertiesPanel looks up `property.detail?.(row) ?? property.cell(row)` per visible property in registry order, grouped by `property.group`
- **Feed view** (Responses): consumes specific properties (customer, comment, rating, respondedAt) in fixed slots; other visible properties become footer pills

Every property has:

```ts
{
  id: "external_id",       // stable identifier, also used as URL sort key
  label: "ID",             // shown in dropdowns, table headers, property rows
  width: 130,              // initial column width in px
  group: "Identity",       // groups in PropertiesPanel and ColumnsControl
  alwaysVisible?: boolean, // can't be hidden by user (Subject, Name, etc.)
  defaultVisible?: boolean,// default visibility
  sortable?: boolean,      // shows sort affordance in table header
  sortKey?: string,        // sort URL key (defaults to id)
  align?: "left" | "right",
  truncate?: boolean,      // default true; opt out for wrap
  cell: (row) => ReactNode, // table cell render
  detail?: (row) => ReactNode, // optional override for PropertiesPanel
  filter?: FilterDescriptor,   // optional — enables filtering on this prop
}
```

Property registries must be `"use client"` because `cell` functions return JSX that can include client components (HoverCard, dnd-kit handles).

**`detail` override pattern**: use `detail` when the table cell uses a tight visual (e.g. `font-mono text-xs` for IDs) that would look out of place in the spacious property panel context.

### EntityTable + EntityToolbar (`src/components/shared/`)

Generic table that renders any `Property<T>[]` over any `T[]`. Features:

- Server-driven pagination via URL `?page=`
- Server-driven sort via URL `?sort=&dir=`
- Drag-to-reorder columns (dnd-kit)
- Drag-to-resize column widths (pointer events)
- Column show/hide (via shared ColumnStateProvider context)
- Per-table localStorage persistence keyed by a `tableId`
- Horizontal scroll, truncate everywhere
- Row click → optional drawer open (`drawerEntity` prop)

Every list page wraps the table+toolbar in a `<ColumnStateProvider tableId="<entity>" properties={REGISTRY}>` so both components share state.

### Shell + sidebar (`src/components/shell/`)

Single-column Notion-style nav. **No SecondaryNav** — section layouts are pass-throughs.

- `SidebarProvider` (`sidebar-context.tsx`) holds `{ width, collapsed, setWidth, toggle }`, persisted to localStorage. Registers the global **Cmd+\\** shortcut. Wraps the workspace layout.
- `PrimaryNav` (server) hard-codes the `SECTIONS` array from views.ts (no DB fetch — counts intentionally dropped from nav per Notion-style cleanliness; totals live on the list page header).
- `PrimaryNavClient` renders the nav. Sections are collapsible (header row is a `<button>`, chevron hover-reveals on the right). Resize handle on the right edge. While dragging, `transition: none` is set inline so resize is 1:1; the collapse transition is the normal `transition: width 200ms`.
- `SidebarToggle` (button with PanelLeft icon + ⌘\ tooltip) lives at the very left of every `Topbar`.
- `Topbar` is the per-page header: `<Topbar crumbs={[...]} actions={...} />`. The `actions` slot is where detail pages drop `<DetailActions entityHref={...} />`.

### Detail page anatomy

**Standalone** (`/<entity>/[id]/page.tsx`):
- Topbar: `crumbs` + `<DetailActions entityHref={...} />` in the `actions` slot
- `<main className="px-14 py-10">` (Notion-style breathing room)
- Two-column grid: content on the left, **sticky right sidebar (260px) with Properties** on the right
- PropertiesPanel uses `layout="stacked"` (label above value, full sidebar width)

**Drawer** (`GlobalDrawer` → DetailBody with `inDrawer`):
- DetailDrawer header: close + open-full + DetailActions (copy + kebab)
- `<main className="px-10 py-7">` (moderate — drawer is narrower)
- Stacked: header → Properties (top) → tabs + table (below). No sidebar.
- PropertiesPanel uses `layout="inline"` (label left ~110px, value right)

The same `<EntityDetailBody inDrawer={...}>` component renders both. Layout switches off `inDrawer`.

### PropertyList primitive (`src/components/shared/property-list.tsx`)

Semantic `<dl><dt><dd>` for property panels. Compound API:

```tsx
<PropertyList layout="inline" | "stacked">
  <PropertyList.Group label="Identity">
    <PropertyList.Row label="Email">jane@example.com</PropertyList.Row>
  </PropertyList.Group>
</PropertyList>
```

`PropertiesPanel` is a thin adapter over this — it walks the registry, filters by visibility, groups by `property.group`, and renders one `<PropertyList.Row>` per visible property.

### DetailActions + hotkeys (`src/components/shared/detail-actions.tsx`)

Copy-link button + kebab menu. **Mount this anywhere** that should support `⌘L`. The hook `useDetailHotkeys` is invoked inside the component, so the shortcut works automatically on any surface where DetailActions appears (standalone topbar, drawer header, future detail surfaces).

- `⌘L` → copies the **entity's standalone URL** (not the current page URL). `preventDefault` overrides the browser's address-bar shortcut (Notion convention).
- `Esc` and `⌘⏎` are registered by DetailDrawer itself (drawer-specific: close + open-full).

### Drawer architecture (URL search-param controlled)

The drawer is **not** a route — it's a globally-mounted client component driven by URL search params. See [DECISIONS.md](DECISIONS.md) "Phase 4" for the rationale.

```
URL shape:
  /<any-page>?drawer=<entity>:<id>          ← drawer is open
  /<any-page>?drawer=<entity>:<id>&dt=<tab> ← drawer + inner tab
```

`?dt=` is the **drawer-tab** param. In-drawer table state is prefixed with `d` (`?dsort=`, `?ddir=`, `?dpage=`) via `paramPrefix="d"` on EntityTable.

Pieces:
- `<GlobalDrawer />` (`global-drawer.tsx`) — mounted once in workspace layout. Reads `?drawer=`, parses, fetches from `/api/drawer/<entity>/[id]`, renders the matching detail body inside `<DetailDrawer>`. Returns null when fully closed.
- `<DrawerLink />` (private to `entity-pill.tsx`) — real `<a href="/entity/id">` so cmd / middle-click opens the full page in a new tab. Default click is intercepted and pushes `?drawer=<entity>:<id>` onto the URL. **Must `forwardRef` and spread props** so `HoverCardTrigger asChild` can inject pointer handlers — otherwise popovers silently break.
- `<DetailDrawer />` (`detail-drawer.tsx`) — chrome only: resizable persisted width, close on Esc / X / outside click. Outside-click skips any open Radix popper (so dismissing a menu doesn't also dismiss the drawer).
- `EntityTable`'s `drawerEntity` prop — when set, row click pushes `?drawer=<entity>:<row.id>` instead of navigating.
- `/api/drawer/<entity>/[id]/route.ts` — returns JSON the detail body needs. Dates ISO-serialize; GlobalDrawer revives them via a regex reviver.

Detail body components (`CustomerDetailBody`, etc.) take an `inDrawer?: boolean` prop. When true: `paramName="dt"`, `paramPrefix="d"`, default tab materialized via `router.replace` on mount.

**Animation (slide-in AND slide-out)** is load-bearing — read carefully:

The exit snapshot is captured **synchronously during render**, not in a `useEffect`. Effects run after commit, but `GlobalDrawer` has an early `if (!active) return null` — by the time an effect could capture the exit state, the drawer would already have unmounted. So when `?drawer=` leaves the URL, we set state inside the render body (using the "derive state from props" pattern):

```ts
if (!currentKey && prevParsedKey.current && !exiting) {
  setExiting({ entity, id, payload }); // captured synchronously
}
```

React queues the update, re-renders with `exiting` set, and the drawer paints its outgoing entity while `translateX(100%)` animates. After 220ms, exit state clears and the drawer unmounts. The open direction uses a two-frame mount pattern (render closed, `requestAnimationFrame` flips to open). Re-opening mid-exit cancels the pending exit in the parsed effect.

If you change this, mirror the pattern — don't reach for `useEffect` for the close transition.

### ColumnStateProvider (`src/lib/column-prefs.tsx`)

Per-table React context holding `{ visibility, order, widths }`. Persisted to `localStorage["simplesat:cols:<tableId>"]`. List view + detail view + each tab uses its own `tableId` so the user can have different visibility per context.

### Feed layout (Responses)

Responses page supports three layouts via `?layout=`:
- **Feed** (default, no `?layout=`): vertical card stream. Newest first. `ResponseFeedCard` renders a sentiment avatar + customer header + `text-base` comment + footer pills (ticket, agent, multi-select answer tags). Card click opens drawer; arrow icon (top-right) opens standalone page.
- **`?layout=response`**: table, one row per response.
- **`?layout=answer`**: table, one row per individual answer (flattened).

Feed card is `max-w-3xl` centered. The other two are full-width tables.

This is a pattern to copy when an entity wants alternate read modes (e.g. a future kanban for Tickets): add layout values to a `LayoutToggle`, parse `?layout=` in the page, render the alternate component. Same `ColumnStateProvider` and `drawerEntity` plumbing.

### Hover popovers (`src/components/shared/entity-popover.tsx`)

`EntityPopoverBody` lives INSIDE `HoverCardContent`, not as a sibling, so it only mounts when the card opens. This is load-bearing — otherwise every entity pill in a 50-row table fires a fetch on mount. Module-level cache means each entity is fetched once per session.

### Ticket Activity timeline (`src/components/tickets/ticket-activity.tsx`)

Chat-style two-sided message timeline rendered on `/tickets/[id]`. Driven by `ticket_messages` + `ticket_events` tables (replaced the legacy `tickets.conversation` JSON column).

- Customer messages render left in gray (`bg-muted`); agent messages right with primary tint; internal notes right with amber-dashed border.
- `buildTimeline` (pure function): chronologically interleave messages + events → insert day dividers → collapse consecutive same-author messages within a 5-minute window into a single group → promote a final `status_changed → solved/closed` event into a centered terminal pill.
- Event rows are muted inline rows indented past the avatar gutter, GitHub-style.
- Smart-time labels: relative under 7 days, absolute beyond. `formatSmartTime` / `formatTimelineDay` live in `src/lib/format.ts`.
- All / Messages-only filter toggle.

### Filter system (`src/lib/filters/`, `src/components/shared/filter-row.tsx`)

Shared cross-surface filter primitive. Used by reports (its own per-base field system) and by list pages (`/tickets` first; other lists follow the same wiring).

- **Filter shape**: `{ propertyId, op, value? }`. Ops are field-type-aware: `STRING_OPS` / `NUMERIC_OPS` / `DATE_OPS` / `ENUM_OPS` / `BOOLEAN_OPS` / `RELATION_OPS` in `src/lib/filters/types.ts`.
- **Server-only field map**: `src/lib/filters/fields/<entity>.ts` holds the Drizzle column refs and per-field allowed ops. Client code can't import these (Drizzle is server-side).
- **Compiler safety** mirrors `reports/compile.ts`: unknown propertyIds dropped, ops not in the field's whitelist dropped. All values flow through Drizzle's typed operators — no string concatenation.
- **URL state**: `?f=<base64(JSON Filter[])>`. Shareable + back/forward-aware. `sanitizeFilter` defends against stale URLs / bad upstream input.
- **Composes with saved views**: `viewWhere && filterWhere ? and(viewWhere, filterWhere) : (viewWhere ?? filterWhere)`.
- **Relative dates** carry structured value `{n, unit, dir}` — not a wrapper on `gt`. Keeps URL self-describing.

### Reports / pivot builder (`src/lib/reports/`, `src/components/reports/`)

URL-driven pivot table editor at `/reports`. Full details in [REPORTS.md](REPORTS.md). Load-bearing rules:

- **Two metadata layers**: visual `Property<T>` registries in `src/lib/properties/<entity>.tsx` own table/detail rendering (`"use client"`); pivot-fields in `src/lib/reports/pivot-fields.ts` owns SQL info (server-friendly). Both keyed on `propertyId`. Don't merge them — they have different runtime constraints.
- **Compiler safety**: `compile.ts` only references columns via `PIVOT_FIELDS[base]`. User filter values become bound parameters via Drizzle's `sql\`…${value}…\`` template. Never splice user input into SQL.
- **`valueOnly: true` fields** (correlated subqueries like `total_tickets`) can only appear in Values / Filters, never in Rows / Columns. UI and compiler both enforce this.
- **URL is the state container**: `?r=<base64(JSON ReportConfig)>`. localStorage holds only the rail width.
- **Metric-typed values**: CSAT, CES, NPS each live as their own first-class pivot value (`csat_avg`, `ces_avg`, `ces_positive_pct`, `nps_score`). Each carries its own SQL formula in `field.valueExpr`; the compiler emits the formula verbatim and ignores the user-picked `agg`. Don't average raw `responses.rating` across metric types — it conflates scales.
- **Compile-time filter guard**: drops any filter whose op isn't in `field.filterOps`. Load-bearing — protects against stale `?r=` URLs and AI-generated filters that would otherwise compile to invalid SQL.
- **AI prompt-to-config**: `buildReportFromPrompt` in `actions.ts` is a real Anthropic call. Requires `ANTHROPIC_API_KEY` in `.env.local`. Full notes in REPORTS.md.
