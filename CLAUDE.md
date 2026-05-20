@AGENTS.md

# Simplesat Vision — agent guide

A clean-room prototype of the future Simplesat product (customer-feedback platform). Not connected to production. Intended as a high-fidelity team alignment artifact, NOT a hacked demo — every change should reinforce a pattern you'd want a team of engineers to copy.

**Seed narrative**: mid-market B2C beauty retailer "Bloom Beauty" (Sephora-style). Three-tier loyalty program (Insider / Gold / Elite). ~95% individual consumers, ~5% B2B accounts (wholesale / corporate gifting / influencer). Simplesat is the underlying product — Bloom Beauty is the demo brand whose customer data flows through it.

If you only read one section: read **Conventions** and **Adding a new \<thing\>**.

## Working with Cory — concierge mode

Cory is non-technical. Operate accordingly:

- **Options-first, not commands-first.** When there's a choice to make, present it as a short menu via `AskUserQuestion`. Don't dump terminal commands at him and expect him to run them — translate every action into a chat phrase he can say back to you.
- **Never end a turn at a "what now?" cliff.** After any action, name the next concrete step, even if it's "you're done — prod deploys in ~60s."
- **Don't auto-do destructive things** (`worktree remove --force`, `branch -D`, `git reset --hard`, force-push, dropping tables) without an explicit yes.
- **When you spawn a worker session for him, give him the exact paste-able prompt** for the new Claude window. Example:

  > Worktree ready at `<path>`.
  >
  > **In a new VS Code window:**
  > 1. File → Open Folder → that path
  > 2. Open the terminal, type `claude`
  > 3. Paste this into the new Claude session:
  >
  > ```
  > /start
  > The task: <one-line task description>
  > ```

### Trigger phrases (treat as `/start`)

When Cory says any of these, run the `/start` slash command (or follow its detection logic inline if it isn't loaded in the current session):

- `/start`, `/menu`
- "new session", "what now?", "menu", "where am I?", "options"
- Any moment when he seems uncertain about next steps

### Context detection

Always detect which role the current session is playing before suggesting actions:

- **Supervisor:** `pwd` ends in `/simplesat-vision`, branch is `main`. Should plan, review PRs, merge, edit docs, spawn worktrees.
- **Worker:** `pwd` is a sibling worktree (e.g. `/simplesat-vision-worktrees/<feature>/` or `/simplesat-vision-<feature>/`), branch is `feat/*` or `docs/*`. Should implement the task, commit, and (when ready) push + open a PR.
- **Other:** Tell Cory what you see (path + branch) and ask what he's trying to do.

## Definition of done — end every implementation with a status block

After any non-trivial implementation (a feature, a bug fix, anything that ends in a commit), end your final response with a short block in exactly this shape:

```
**Status:** <where the code is — uncommitted / committed locally on `<branch>` / pushed to GitHub / PR #N open / merged>
**Verified:** <what you actually tested — dev server, specific routes, lint, build>
**Next step:** <the next concrete action Cory could take, written as a chat phrase he can say back>
**Risks/follow-ups:** <anything to flag, or "none">
```

Rules:
- Keep it under ~6 lines total. Fast orientation, not a report.
- Quote actual branch names, PR numbers, and URLs — never be vague.
- "Next step" should be a single thing, phrased so Cory can copy-paste it back ("push and open a PR", "merge PR #N", "run /simplify on these files").
- Skip for trivial work (typo fix, single-line tweak, pure questions). Use judgment — the rule is for anything someone might want to ship or revisit.
- This block goes AFTER the normal task summary, not instead of it.

## Stack lock-in

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) |
| Lang | TypeScript strict |
| Styling | Tailwind v4 + shadcn/ui (Radix-based, copy-paste components) |
| Data | Drizzle ORM + better-sqlite3, local file at `db/simplesat.db` |
| Tables | Custom EntityTable (TanStack-free) driven by Property registry |
| DnD | dnd-kit (column reorder; reserved for future Reports builder) |
| Charts | Recharts (reserved for future Reports) |
| Icons | Lucide |
| Font | Lato via `next/font/google`, with system stack fallback |
| Seed | Faker, deterministic via `faker.seed(42)` |
| Deploy target | Vercel (would swap to Turso/libSQL for SQLite hosting) |

**Do not** add: state management libraries, CSS-in-JS, testing setup, auth, or Storybook (Cory is planning Storybook later; design for it but don't add it yet).

## Architecture in one diagram

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
│   <entity>/                     Per-entity bodies +  │
│                                 entity-specific pills│
│   responses/                                         │
│     response-feed-card.tsx      feed-style card      │
│   surveys/                                           │
│     survey-detail.tsx           detail body (no list)│
│   reports/                      pivot builder        │
│     report-builder.tsx          orchestrator         │
│     pivot-table.tsx             cross-tab renderer   │
│     property-rail.tsx           draggable chips      │
│     inline-axis.tsx             4-axis drop strip    │
│     base-entity-dropdown.tsx                         │
│     axis-chip.tsx, axis-zone.tsx                     │
│     filter-add.tsx, filter-chips.tsx                 │
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
│                                                      │
│ src/lib/                                             │
│   topics.ts                     taxonomy + rollup    │
│   properties/                   Property registries  │
│     custom-fields.ts            synced-source defs   │
│     custom-field-properties.tsx defs → Property<T>[] │
│   column-prefs.tsx              ColumnState context  │
│   view-predicates.ts            SQL where helpers    │
│   views.ts                      saved view defs      │
│   use-detail-hotkeys.ts         Esc / ⌘L / ⌘⏎       │
│   color-from-name.ts, format.ts, ids.ts              │
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

Single source of truth for how an entity's fields render. Powers both:

- **List view**: EntityTable looks up `property.cell(row)` per row per visible column
- **Detail view**: PropertiesPanel looks up `property.detail?.(row) ?? property.cell(row)` per visible property in registry order, grouped by `property.group`
- **Feed view** (Responses): the feed card consumes specific properties (customer, comment, rating, respondedAt) in fixed slots; other visible properties become footer pills

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

Single-column Notion-style nav. **No SecondaryNav anymore** — section layouts are pass-throughs.

- `SidebarProvider` (`sidebar-context.tsx`) holds `{ width, collapsed, setWidth, toggle }`, persisted to localStorage. Registers the global **Cmd+\\** shortcut. Wraps the workspace layout.
- `PrimaryNav` (server) hard-codes the `SECTIONS` array from views.ts (no DB fetch — counts intentionally dropped from nav per Notion-style cleanliness; totals live on the list page header).
- `PrimaryNavClient` renders the nav. Sections are collapsible (header row is a `<button>`, chevron hover-reveals on the right; right edge reserved for future per-section actions). Resize handle on the right edge. While dragging, `transition: none` is set inline so resize is 1:1; the collapse transition is the normal `transition: width 200ms`.
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
- `Esc` and `⌘⏎` are registered by DetailDrawer itself (they're drawer-specific: close + open-full).

### Drawer architecture (URL search-param controlled)

The drawer is **not** a route — it's a globally-mounted client component driven by URL search params. See DECISIONS.md "Phase 4" for the rationale.

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

**Animation (slide-in AND slide-out)**: this is load-bearing — read carefully.

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

### Reports / pivot builder (`src/lib/reports/`, `src/components/reports/`)

URL-driven pivot table editor at `/reports`. Full details in `REPORTS.md`. Key load-bearing rules for this surface:

- **Two metadata layers**: visual `Property<T>` registries in `src/lib/properties/<entity>.tsx` own table/detail rendering ("use client"); pivot-fields in `src/lib/reports/pivot-fields.ts` owns SQL info (server-friendly). Both keyed on `propertyId`. Don't merge them — they have different runtime constraints.
- **Compiler safety**: `src/lib/reports/compile.ts` only references columns via `PIVOT_FIELDS[base]`. User filter values become bound parameters via Drizzle's `sql\`…${value}…\`` template. Never splice user input into SQL.
- **`valueOnly: true` fields** (correlated subqueries like `total_tickets`) can only appear in Values / Filters, never in Rows / Columns. Both UI (`AddFieldButton.allowValueOnly`, `defaultAxis()`) and `compile.ts → addAxis` enforce this.
- **URL is the state container**: `?r=<base64(JSON ReportConfig)>`. Shareable + back-forward-aware. localStorage holds only the rail width.
- **dnd-kit `DragOverlay`** renders the cursor-following chip preview. The source chip alone (faded via `isDragging`) is not enough — users need to see what's moving.
- **Rowspan grouping** in `pivot-table.tsx`: when two row axes share a value across consecutive rows, the first `<th>` gets a `rowSpan`. Computed via a pure pass over row labels; don't reach for state.
- **Entity-based property grouping**: rail and Add Field popovers group by source entity (`group` field on PivotField). `GROUP_ORDER[base]` defines the per-base render order — primary entity first, joined entities after. The label "Assignee" is used on the ticket base specifically (different from "Team member" elsewhere) per the Simplesat semantic distinction.
- **Inline axis row**: Rows / Columns / Values / Filters all live in one horizontal strip with dividers. Each is its own `useDroppable` target.
- **AI prompt-to-config**: `buildReportFromPrompt` in `actions.ts` is a real Anthropic call — `claude-haiku-4-5` with forced tool use (`build_report` tool whose `input_schema` mirrors `ReportConfig`). System prompt is built per-base from `PIVOT_FIELDS[base]` and cached via `cache_control: { type: "ephemeral" }`. Output is sanitized against the registry (unknown propertyIds dropped, `valueOnly` fields kept out of rows/columns, ops cross-checked against `field.filterOps`). API errors surface inline in the dialog. Requires `ANTHROPIC_API_KEY` in `.env.local`. Full notes in `REPORTS.md → AI build-with-prompt`.
- **Metric-typed values**: CSAT, CES, and NPS each live as their own first-class pivot value (`csat_avg`, `ces_avg`, `ces_positive_pct`, `nps_score`) under the `Metrics` rail group. Each carries its own SQL formula in `field.valueExpr`; the compiler emits the formula verbatim and ignores the user-picked `agg`. On the response base the formula is a direct aggregate (`AVG(CASE WHEN survey_type='csat' THEN rating END)`), so `filterOps: []` — can't appear in WHERE. On customer / team_member / ticket bases it's a correlated subquery (`(SELECT … FROM responses WHERE …)`), which is row-level filterable (`filterOps: NUMERIC_OPS`). Don't average raw `responses.rating` across metric types — it conflates CSAT / CES / NPS scales and produces nonsense; the metric-typed values exist precisely so callers don't have to think about this.
- **Compile-time filter guard**: `compile.ts` drops any filter whose op isn't in `field.filterOps`. Load-bearing — protects against stale `?r=` URLs and AI-generated filters that would otherwise compile to invalid SQL (e.g. aggregate expressions in WHERE).

## Conventions

- **Component reuse > custom CSS**. Three layers, top to bottom: (1) Radix / dnd-kit / Recharts primitives — don't touch, (2) shadcn wrappers in `src/components/ui/` — don't edit, only add via shadcn CLI, (3) domain components in `src/components/shared/` — compose ui/ + behavior + your data shapes. Never write a custom component from scratch when an existing shadcn primitive composes. No negative-margin tricks, custom scroll/animation logic, or hand-rolled keyboard handling unless the primitive truly doesn't exist.
- **Slot APIs over prop explosion**. When a shared component has stable structure but variable content (toolbars, headers, list rows), use named slot props (`leading`, `trailing`, `actions`) or compound components (`<PropertyList.Group>`) — never accept a dozen booleans that toggle internal regions. Radix's `asChild` is the standard escape hatch for swapping the underlying element.
- **Component-per-file in `shared/`**: anything reused twice becomes its own file in `src/components/shared/`. This is forward-prep for Storybook.
- **No `any`**. Strict TypeScript.
- **Server Components by default**. Use `"use client"` only when you need hooks (useState, useEffect, useSearchParams), browser APIs (localStorage), or event handlers.
- **URL is the state container** for sort, pagination, view filter, tab, layout toggle, drawer open/closed, and the in-drawer tab. localStorage is for *preferences* (column widths/visibility/order, drawer width, sidebar width/collapsed, section collapsed-state).
- **No `<a>` tags** for internal navigation. Use Next `Link`.
- **No date/number libraries**. Use `Intl.*` via `src/lib/format.ts` (includes `formatRelative` for feed-style "3 hours ago").
- **No em dashes** in user-facing copy.
- **Font sizes** (Slack/Asana-style — accessibility over density):
  - Body / nav / detail values / property labels / table cells & headers: `text-sm` (15px — Tailwind's `text-sm` is **overridden** from its default 14px in [`globals.css`](src/app/globals.css), see DESIGN.md → Typography)
  - Feed card comment text: `text-base` (16px) — the centerpiece of a feed card gets more weight
  - Stateful pills (status, channel, tier) + `kbd`: `text-xs` (12px) — only because the visual is dominant and content short
  - Entity name in detail header: `text-3xl` (30px)
  - **Do not use `text-xs` for body copy, labels, or section headings.** If something feels like it needs to be smaller, the answer is usually muted color, not smaller size.
- **No forced uppercase** on property names, group labels, section titles, or column headers. Natural sentence case throughout.
- **Value font color rule** (applied across all property registries):
  - `text-foreground` — primary identifiers that answer *"what is this row?"*: name, subject, company, tags, comment text, primary answer values
  - `text-muted-foreground` — secondary metadata that *qualifies* the row: emails, IDs, counts, dates, "Unassigned", helpdesk source, answer types
  - Colored pill — *stateful* values: status, channel, tier, rating, survey state
- **Pill component model**:
  - `CustomerPill`, `TeamMemberPill`, `TicketPill`, `ResponsePill` (with `id`) — wrapped in HoverCard, render a `<DrawerLink>`, click opens drawer (cmd-click → standalone full page)
  - `CompanyPill` — text only, no padding, no popover, no link (company is a string, not yet an entity)
  - `ResponsePill` (without `id`) — plain `<span>`, rating + stars only; used as static value display
  - All interactive pills have a persistent `bg-accent/40` tint + always-visible `ArrowUpRight` arrow icon so they read as obviously clickable. Hover deepens the tint. Don't make them invisible-until-hover.
  - All interactive pills use `-mx-1 px-1` so their hover background extends slightly past the text *without* visually indenting the text relative to the column header.
- **EntityTable in drawers**: same component as the main lists. Pass `pageSize = rows.length` to disable pagination. Use a distinct `tableId` (e.g., `customer-tickets`). When the table sits inside a drawer, pass `paramPrefix="d"` and `drawerEntity="<row entity>"` so row click opens a drawer for the inner row entity without clobbering the outer page's URL state.
- **EntityTable on list pages**: pass `drawerEntity="<entity>"` so any click on a row body opens the drawer. Pills inside the row keep their own click behavior (the row handler skips clicks whose target is inside `a, button, [role='button']`).
- **Topbar slots**: `<Topbar crumbs={...} actions={<DetailActions ... />} />`. Detail pages always pass actions; list pages don't.
- **DrawerLink must forwardRef + spread props**: `entity-pill.tsx`'s `DrawerLink` is used as an `asChild` target of Radix `HoverCardTrigger`. If it doesn't forward ref or spread `...rest`, Radix can't inject pointer handlers and popovers silently break.
- **Aggregate subqueries in Drizzle**: do NOT use `${schema.table.column}` interpolation inside a `sql\`\`` correlated subquery — it produces a parameter placeholder, not a column reference, and you get NULL rows. Use literal `"table.column"` SQL instead. See `listCustomers` for the right pattern.
- **Cursor pointer everywhere actionable**: shadcn's `Button` doesn't include `cursor-pointer` by default. Add it to any button, link, or `[role="button"]` that's interactive. (Audit when adding new components — easy to miss.)

## Visual tokens

**The token dictionary lives in [DESIGN.md](DESIGN.md).** That file owns the color/typography/border/state values and the architectural rules for how to add or change one. This section covers usage *philosophy* — when to reach for which token — that doesn't fit a table.

### Brand vs primary

Two tokens, distinct roles — don't conflate.

- **`--primary`** (blue `#007eff`) is the workhorse action color: primary buttons, active nav, focus rings (`ring-primary/30`), informational/neutral links. `--ring` mirrors `--primary`.
- **`--brand`** (green `#43BE64`) is a brand-moment accent: logo flourish, marketing-flavored emphasis. **Not** for primary actions, decoration, or hover tints.

Positive metrics and success states use `--positive` (the soft-green badge pair), **not** `--brand`. Neutral hover stays `bg-accent/40` (existing pill pattern).

### Status colors

For badges, semantic pills, inline state indicators. Defined as CSS vars in `globals.css`; consume via Tailwind utilities (`bg-positive text-positive-foreground`, etc.) — never hardcode hex in components.

Backgrounds are deliberately softer than the Figma "Emotive" palette — full-saturation status colors look loud at our table/feed density. Full values in [DESIGN.md](DESIGN.md).

Positive shares the brand-green hue family but uses softer values for backgrounds — don't substitute `--primary` directly.

### Spacing rhythm

Base unit 4px. **Allowed values only:** `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. No `6`, `10`, `14`. Pick the nearest allowed value.

Defaults:
- Page outer padding: `24` (`32` on `≥xl`)
- Card padding: `20`
- Section vertical gap: `32`
- Form field gap: `16`
- Drawer padding: `24`
- Detail page padding: `px-14 py-10` standalone / `px-10 py-7` in drawer (already established)

### Shadows

Borders-first product. Shadows only on Radix portals: HoverCard, Popover, DropdownMenu, Dialog, Toast. **Never on inline cards, table rows, list items, or pills.** Shadcn's portal defaults already match — don't override with new shadow utilities.

### Chart palette (Recharts, when Reports lands)

Multi-series order:
1. `#007eff` primary blue
2. `#43BE64` brand green
3. `#F4B942` neutral yellow
4. `#E4574C` negative red
5. `#9F7AEA` purple (only if 5+ series)
6. `#8D9399` muted grey

Grid lines: `var(--border)`. Axis labels: `text-muted-foreground text-xs`. Tooltip: white, `rounded-lg`, default border. No titles inside charts — title lives in the card header.

### When in doubt

1. Look at Notion or Slack first.
2. Check the prototype for an analogous pattern.
3. More whitespace over less.
4. Fewer font sizes over more.
5. Border over shadow.

## Adding a new \<thing\>

### Add a property to an existing entity

1. Add it to `src/lib/properties/<entity>.tsx` with a `cell` render
2. Add a `detail` override if the table cell uses tight visuals (e.g. `font-mono text-xs`) that look out of place in the spacious property panel
3. If the data isn't on the row type, extend the query (`src/db/queries/<entity>.ts`)
4. Default visibility via `defaultVisible: true|false`

It appears immediately in: list table, detail PropertiesPanel, embedded tables, and the Responses feed (as a footer pill, if visible).

### Add a saved view

1. Add a `ViewDef` to `src/lib/views.ts` under the matching `<ENTITY>_VIEWS` array
2. Add a SQL where helper to `src/lib/view-predicates.ts` under `<entity>sViewWhere`
3. If the predicate touches a JOINed table, use `exists(subquery)` (see `tickets` "rated" / "detractors" view)

Sidebar nav picks it up automatically (PrimaryNav reads views.ts at server-render time).

### Add a new entity

1. **Schema**: add to `src/db/schema.ts`. `npm run db:generate` + `npm run db:migrate`.
2. **Seed**: update `src/db/seed.ts`. Run `npm run db:reset`.
3. **Queries**: new file `src/db/queries/<entity>.ts` — list query (view + sort + pagination) and detail query.
4. **Property registry**: `src/lib/properties/<entity>.tsx`.
5. **Views**: `src/lib/views.ts` + `view-predicates.ts`.
6. **Routes**:
   - `src/app/(workspace)/<entity>/layout.tsx` — thin pass-through with `export const dynamic = "force-dynamic"`. No SecondaryNav anymore.
   - `page.tsx` — list, uses EntityTable with `drawerEntity="<entity>"`. Renders `<Topbar crumbs={...} />`.
   - `[id]/page.tsx` — full standalone detail. Renders `<Topbar crumbs={...} actions={<DetailActions entityHref={...} />} />` then the detail body.
   - `loading.tsx` with TableSkeleton.
7. **Detail body**: `src/components/<entity>/<entity>-detail.tsx`. Client component, accepts `inDrawer?: boolean`. Two-column grid when standalone, stacked when drawer. PropertiesPanel `layout={inDrawer ? "inline" : "stacked"}`.
8. **Popover route**: `src/app/api/popover/<entity>/[id]/route.ts`.
9. **Drawer route**: `src/app/api/drawer/<entity>/[id]/route.ts`.
10. **GlobalDrawer wiring** (`global-drawer.tsx`): add the entity to `DrawerEntity` union, `ENTITY_PATHS`, the `DrawerData` variant, and the render branch.
11. **EntityPopover wiring** (`entity-popover.tsx`): add to the `Entity` union + render branch.
12. **Pill component** (`entity-pill.tsx`): extend with `<entity>Pill`. HoverCard + DrawerLink + persistent tint + arrow.
13. **Primary nav** (`primary-nav.tsx`): add to the `SECTIONS` array with icon, label, views from views.ts.

## Next.js 16 gotchas

- `params` and `searchParams` are Promises in pages and route handlers. Always `await props.params` / `await props.searchParams`.
- Use `PageProps<"/path">` type helper from generated route types.
- `next lint` is gone. Use `eslint` directly (we do via `npm run lint`).
- Turbopack is the default. `--turbopack` flag no longer needed.
- Dev cache lives in `.next/dev/`. If you see `Cannot find module '.next/dev/...'` errors, kill `next dev` and `rm -rf .next` and restart.
- `force-dynamic` is needed wherever client `useSearchParams` is in the tree. Workspace layout sets it (because `GlobalDrawer` reads `?drawer=`), so leaf pages inherit. Section layouts also set it as belt-and-suspenders.

## Common commands

| | |
|---|---|
| `npm run dev` | Turbopack dev server |
| `npm run build` | Production build (also good for TS check) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check only |
| `npx next typegen` | Regenerate `PageProps<>` types |
| `npm run db:reset` | Wipe db + migrate + seed |
| `npm run db:studio` | Drizzle Studio against local db |

## Data shape quick-ref

| Entity | Internal id | External id | Avg rating threshold | Notes |
|---|---|---|---|---|
| Ticket | `tkt_<nanoid>` | `helpdeskExternalId` (numeric string) | n/a | All seeded helpdesk='zendesk'. Carries `priority` enum (low/normal/high/urgent, default normal). |
| Customer | `cus_<nanoid>` | none yet | <3 red, <4 amber | Bloom Beauty B2C retail. ~95% individuals with `company = null`; ~5% B2B (with `company`, `companyExternalId`, `companyDomain`). First 3 are detractor B2B accounts (Atlas Hospitality, Pacific Beauty Distributors, Crown Department Stores). Core columns: tier (insider/gold/elite), language. Carries sparse `customProperties` JSON for beauty-personalization + loyalty + engagement attributes. |
| Team member | `tm_<nanoid>` | none yet | <3.5 red, <4 amber | 4 seeded as low performers. First-class `region`, `language`, `groupId` (FK to `team_member_groups`); additional sparse `customProperties` JSON. |
| Team member group | `tmg_<nanoid>` | none | n/a | Six seeded groups (Customer Care / Returns & Exchanges / Online Orders / Stores & BOPIS / Loyalty & VIP / Escalations). Mirrors Zendesk Groups. Used for filtering and `TeamGroupPill`. |
| Response | `rsp_<nanoid>` | none yet | follows customer thresholds | `answers` JSON has rating/multi-choice/multi-select/comment; each may carry per-answer `topics`. Rolled-up dedup'd `topics` JSON at the row level. `surveyId` FK + denormalized `surveyType`. |
| Survey | `svy_<nanoid>` | none yet | n/a | Has metric (csat/nps/ces/five_star/custom), channel, scale, status, questions JSON. Pill + popover + drawer + `/surveys/[id]`. **Not in primary nav** — survey management eventually lives in settings. |
| QA Evaluation | `qa_<nanoid>` | (schema exists, no data) | — | Strategic placeholder for phase 4+ |

### Seed scale

`npm run db:reset` produces: 8 surveys · 1,200 customers · 25 team members · 50,000 tickets · ~14,200 responses. ~11,400 of those responses have rolled-up topics. Faker is seeded deterministically (`faker.seed(42)`).

### Core fields vs custom attributes

Every entity in Simplesat is modelled as a fixed set of **core fields** plus a flat **`customAttributes` array** in the public API. The schema mirrors this:

- **Core fields** = real DB columns (name, email, company, language, tier, …). Rendered via dedicated components (`CompanyPill`, `TierPill`, `TeamGroupPill`, etc.) and have stable types.
- **Custom attributes** = sparse JSON bag in `customProperties`. Rendered via the generic `customFieldProperties` adapter. The public API serializes these as a flat `customAttributes: [{key, value}]` array.

**Critical**: Simplesat genuinely cannot attribute a custom-attribute value to a specific integration. The public API, Zendesk push, Intercom webhook, CSV import, and manual edits all write into the same single namespace. **Do not** tag `CustomFieldDef` entries with a `source` attribute and **do not** render "Synced from X" anywhere — that would be a fiction. The `group` field on `CustomFieldDef` is a user-curated semantic category (Profile / Beauty profile / Loyalty / Engagement / Purchase behavior / B2B for customers; Profile / Schedule / Skills / Performance for team members), not provenance.

The "many customers with many custom attributes" UX is faked via two layers:

1. **`customers.customProperties` / `team_members.customProperties`** — JSON column carrying sparse values keyed by definition ID. Each customer holds 25-50 of the ~55 available customer keys; each team member holds 8-16 of the ~22 team-member keys.
2. **`src/lib/properties/custom-fields.ts`** — TS const array of `CustomFieldDef` ({id, label, group, dataType, importance 1-5, defaultVisible, enumValues?, sample()}). Importance drives default ordering + default visibility. `sample()` is a closure used by seed.

`src/lib/properties/custom-field-properties.tsx` turns those defs into `Property<T>[]` entries that the customer + team-member registries spread in. Custom attributes show up automatically as hidable columns grouped by semantic category and as filterable pivot fields in Reports (importance ≥3 surfaces in the rail; the rest stay in the column picker only).

**Don't add a `property_definitions` DB table for this** — the TS const is hand-tunable for the demo narrative and keeps everything serverless-friendly.

### Topic taxonomy

`src/lib/topics.ts` defines the 68 predefined topics across 20 groups (sourced from production via `csv_exports/topics_groups.csv`). Each topic has `{ id, label, group }` where `id` is the kebab-case slug used in storage. Per-answer topics live on `SurveyAnswer.topics`; response-level `topics` is rolled-up + deduped via `rollupTopics()` (negative > neutral > positive on conflict).

**Don't invent new topics.** The taxonomy comes from production; updates land via that CSV. The seed only uses real topic IDs.

### Comment bank

`db/comments.json` is a hand-curated bank of fake retail-voice comments, bucketed by metric × rating (`csat_1..5`, `ces_1..5`, `five_star_1..5`, `nps_promoter/passive/detractor`, `custom`). Seed loads it via `pickComment(metric, rating)` to attach realistic-sounding text to responses. All entries are synthetic from inception — no PII concerns, no harvest script. Edit the JSON directly to evolve the bank. Empty buckets fall back to the nearest CSAT bucket via `pickComment`.

## Keyboard shortcuts

| Key | Action | Where |
|---|---|---|
| `⌘\` | Toggle sidebar | Anywhere (registered in SidebarProvider) |
| `⌘L` | Copy entity link | Anywhere DetailActions is mounted (standalone topbar, drawer) |
| `⌘⏎` | Open drawer entity in full page | Drawer only |
| `Esc` | Close drawer | Drawer only |

## Don't do

- **Don't reintroduce SecondaryNav.** Views live in PrimaryNav now. Section layouts are pass-throughs.
- **Don't put view counts in the nav.** Cleaner without them; totals live on the list page.
- **Don't reach for `useEffect` for the drawer close animation.** It runs after the unmount check. The exit snapshot must be captured synchronously during render. See "Drawer architecture → Animation".
- **Don't add a SecondaryNav-style left column on detail pages.** Standalone detail = 2-col grid with sidebar right (not left).
- **Don't reintroduce the sticky-first-column behavior**; Cory will spec a configurable version later.
- **Don't add per-cell text-size classes inside pills** — they should match the parent table's `text-sm`.
- **Don't fetch popover data on pill mount** — it has to be lazy via `EntityPopoverBody` inside `HoverCardContent`.
- **Don't write JSX in `src/lib/` files** unless they're `.tsx` AND marked `"use client"`.
- **Don't use `${schema.table.column}` inside a correlated SQL subquery** (see Conventions).
- **Don't embed ad-hoc tables in detail pages.** Use EntityTable.
- **Don't bring back the `@drawer` parallel-route folders** or the `rowHrefBase` prop on EntityTable. Drawer is search-param controlled; row navigation goes through `drawerEntity`. See DECISIONS.md "Phase 4".
- **Don't force uppercase on labels** (`uppercase tracking-*` on property names, group labels, section titles, or column headers).
- **Don't add vertical column borders** (`border-r`) to tables — only horizontal row dividers.
- **Don't render an entity's internal id in a detail-page header.** It's still in the properties panel under "Identity".
- **Don't use `text-xs` for body copy, labels, or section headings.** See Font sizes convention.
- **Don't lock body scroll when the drawer opens.** Background remains scrollable by design.
- **Don't add Surveys to the primary nav.** It's a first-class entity for pill/popover/drawer/pivot purposes, but management belongs in settings (per Cory). The standalone `/surveys/[id]` page exists; there is intentionally no `/surveys` list route.
- **Don't invent topics.** The taxonomy in `src/lib/topics.ts` mirrors production. New topics arrive via `csv_exports/topics_groups.csv`.
- **Don't ship real customer comments.** `db/comments.json` is hand-curated synthetic copy — keep it that way. If you reseed for a different vertical, rewrite the comment bank from scratch rather than harvesting from real exports.
- **Don't add a `source` field to `CustomFieldDef`** or render "Synced from X" anywhere. Simplesat cannot attribute custom-attribute values to a specific integration; that grouping was a fiction. Use the free-text semantic `group` for organizing custom attributes in the UI.
- **Don't add a `property_definitions` DB table for custom attributes.** Keep them in `src/lib/properties/custom-fields.ts` so importance/group/sample can be hand-tuned for the demo narrative.
- **Don't add a `companies` / `organizations` entity.** Organization data is rolled up onto the customer (`customers.company`, `companyExternalId`, `companyDomain`). Per Cory: lookup chains via the help desk make a dedicated entity unnecessary at this scope.

## See also

- `README.md` — surface-level quickstart
- `DESIGN.md` — design token reference (colors, typography, borders, states)
- `DECISIONS.md` — explicit assumptions made along the way
- `REPORTS.md` — pivot editor status + roadmap (AI integration is next)
- `AGENTS.md` — Next.js 16 warning (read before writing route code)
