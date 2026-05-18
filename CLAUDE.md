@AGENTS.md

# Simplesat Vision — agent guide

A clean-room prototype of the future Simplesat product (B2B CSAT feedback tool). Not connected to production. Intended as a high-fidelity team alignment artifact, NOT a hacked demo — every change should reinforce a pattern you'd want a team of engineers to copy.

If you only read one section: read **Conventions** and **Adding a new \<thing\>**.

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
| Font | System stack |
| Seed | Faker, deterministic via `faker.seed(42)` |
| Deploy target | Vercel (would swap to Turso/libSQL for SQLite hosting) |

**Do not** add: state management libraries, CSS-in-JS, testing setup, auth, or Storybook (Cory is planning Storybook later; design for it but don't add it yet).

## Architecture in one diagram

```
┌──────────────────────────────────────────────────────┐
│ src/app/                                             │
│   (workspace)/                                       │
│     layout.tsx                  PrimaryNav           │
│     page.tsx                    home + insights      │
│     <entity>/                                        │
│       layout.tsx                SecondaryNav + Views │
│         + @drawer parallel slot for intercepted      │
│           detail routes                              │
│       page.tsx                  list (EntityTable)   │
│       [id]/page.tsx             full detail page     │
│       @drawer/(.)[id]/page.tsx  drawer detail        │
│       @drawer/default.tsx       null                 │
│       loading.tsx               skeleton             │
│   api/popover/<entity>/[id]/route.ts                 │
│                                                      │
│ src/components/                                      │
│   shared/                       The component        │
│     entity-table.tsx              ↑ everything       │
│     entity-toolbar.tsx              shared lives     │
│     entity-pill.tsx                 here. If you     │
│     entity-popover.tsx              build a new      │
│     properties-panel.tsx            pattern, put it  │
│     detail-drawer.tsx               in shared/ from  │
│     relation-tabs.tsx               commit one.      │
│     avg-rating.tsx                                   │
│     stat-card.tsx                                    │
│     tier-pill.tsx                                    │
│     team-pill.tsx                                    │
│     star-rating.tsx                                  │
│     tag.tsx                                          │
│     avatar.tsx                                       │
│     property-row.tsx                                 │
│     detail-section.tsx                               │
│     columns-control.tsx                              │
│     table-skeleton.tsx                               │
│     layout-toggle.tsx                                │
│   shell/                        Nav + chrome         │
│   <entity>/                     Per-entity bodies +  │
│                                 entity-specific pills│
│   ui/                           shadcn (don't edit)  │
│                                                      │
│ src/db/                                              │
│   client.ts                     singleton Drizzle    │
│   schema.ts                     all tables           │
│   seed.ts                       faker, deterministic │
│   queries/                                           │
│     tickets.ts, customers.ts, team-members.ts,       │
│     responses.ts, counts.ts, insights.ts             │
│                                                      │
│ src/lib/                                             │
│   properties/                   Property registries  │
│     types.ts                      cell + detail      │
│     tickets.tsx                   renders            │
│     customers.tsx                                    │
│     team-members.tsx                                 │
│     responses.tsx                                    │
│     response-answers.tsx                             │
│   column-prefs.tsx              ColumnState context  │
│   view-predicates.ts            SQL where helpers    │
│   views.ts                      saved view defs      │
│   color-from-name.ts            hash → palette       │
│   format.ts                     Intl-based formatters│
│   ids.ts                        nanoid prefixed ids  │
└──────────────────────────────────────────────────────┘
```

## Core abstractions (in order of importance)

### Property registry (`src/lib/properties/<entity>.tsx`)

Single source of truth for how an entity's fields render. Powers both:

- **List view**: the EntityTable looks up `property.cell(row)` per row per visible column
- **Detail view**: the PropertiesPanel looks up `property.detail?.(row) ?? property.cell(row)` per visible property in registry order, grouped by `property.group`

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

Property registries must be `"use client"` because their `cell` functions return JSX that can include client components (HoverCard, dnd-kit handles).

### EntityTable + EntityToolbar (`src/components/shared/`)

Generic table that renders any `Property<T>[]` over any `T[]`. Features:

- Server-driven pagination via URL `?page=`
- Server-driven sort via URL `?sort=&dir=`
- Drag-to-reorder columns (dnd-kit)
- Drag-to-resize column widths (pointer events)
- Column show/hide (via shared ColumnStateProvider context)
- Per-table localStorage persistence keyed by a `tableId`
- Horizontal scroll, truncate everywhere
- Row click → optional `rowHrefBase` navigation

Every list page wraps the table+toolbar in a `<ColumnStateProvider tableId="<entity>" properties={REGISTRY}>` so both components share state.

### Drawer architecture (Next.js parallel intercepting routes)

Each section that has detail pages has:

```
<section>/
  layout.tsx               renders {children}{drawer} side by side
  [id]/page.tsx            full standalone page (direct nav / refresh)
  @drawer/
    default.tsx            returns null
    (.)[id]/page.tsx       intercepts /<section>/<id> when clicked
                           from inside /<section>, renders detail
                           in a <DetailDrawer> overlay
```

DetailDrawer is fixed-right, no backdrop. Close via X, Escape, or click on non-interactive space outside. Width is resizable + persisted.

The detail body component (e.g., `TicketDetailBody`) is shared between the full page and the drawer.

### ColumnStateProvider (`src/lib/column-prefs.tsx`)

Per-table React context holding `{ visibility, order, widths }`. Persisted to `localStorage["simplesat:cols:<tableId>"]`. List view + detail view + each tab uses its own `tableId` so user can have different visibility per context.

### Hover popovers (`src/components/shared/entity-popover.tsx`)

`EntityPopoverBody` lives INSIDE `HoverCardContent`, not as a sibling, so it only mounts when the card opens. This is load-bearing — otherwise every entity pill in a 50-row table fires a fetch on mount. Module-level cache (`Map<string, unknown>`) means each entity is fetched once per session.

## Conventions

- **Component-per-file in `shared/`**: anything reused twice becomes its own file in `src/components/shared/`. This is forward-prep for Storybook.
- **No `any`**. Strict TypeScript.
- **Server Components by default**. Use `"use client"` only when you need hooks (useState, useEffect), browser APIs (localStorage), or event handlers.
- **URL is the state container** for sort, pagination, view filter, tab, layout toggle. localStorage is for *preferences* (column widths/visibility/order, drawer width).
- **No `<a>` tags** for internal navigation. Use Next `Link`.
- **No date/number libraries**. Use `Intl.*` via `src/lib/format.ts`.
- **No em dashes** in user-facing copy.
- **Font sizes**:
  - Body / nav / detail labels: `text-base` (16px)
  - Table cells, pill labels, detail values: `text-sm` (14px)
  - Property-row labels, column headers, decorative badges: `text-xs` (12px)
- **Pill component model**:
  - `CustomerPill`, `TeamMemberPill`, `TicketPill` → wrapped in HoverCard, link to detail, route by internal id but display external/friendly id
  - `CompanyPill` → text only (no avatar, no popover — company is a string, not yet an entity)
  - `ResponsePill` → rating + stars, no popover (it's a value, not an entity reference)
- **EntityTable in drawers**: yes, same component as the main lists. Pass `pageSize = rows.length` to disable pagination. Use a distinct `tableId` (e.g., `customer-tickets`).
- **Aggregate subqueries in Drizzle**: do NOT use `${schema.table.column}` interpolation inside a `sql\`\`` correlated subquery — it produces a parameter placeholder, not a column reference, and you get NULL rows. Use literal `"table.column"` SQL instead. See `listCustomers` for the right pattern.

## Adding a new \<thing\>

### Add a property to an existing entity

1. Add it to `src/lib/properties/<entity>.tsx` with a `cell` render
2. If the data isn't already on the row type, extend the query (`src/db/queries/<entity>.ts`)
3. If the property is computed (e.g., aggregate), update the query's projection
4. Default visibility via `defaultVisible: true|false`

It appears immediately in:
- The list table (toggleable via Properties)
- The detail PropertiesPanel (toggleable via Properties)
- All embedded tables in other entities' detail tabs (Customer tickets, Team member responses)

### Add a saved view

1. Add a `ViewDef` to `src/lib/views.ts` under the matching `<ENTITY>_VIEWS` array
2. Add a SQL where helper to `src/lib/view-predicates.ts` under `<entity>sViewWhere`
3. If the predicate touches a JOINed table, use `exists(subquery)` (see `tickets` "rated" / "detractors" view)

Count + filtering wire up automatically.

### Add a new entity

This is bigger. Rough recipe:

1. **Schema**: add to `src/db/schema.ts`. Generate migration with `npm run db:generate`. Apply with `npm run db:migrate`.
2. **Seed**: update `src/db/seed.ts`. Run `npm run db:reset`.
3. **Queries**: new file `src/db/queries/<entity>.ts` exporting a list query (with view + sort + pagination) and a detail query.
4. **Property registry**: `src/lib/properties/<entity>.tsx`
5. **Views**: `src/lib/views.ts` + `view-predicates.ts`
6. **Routes**:
   - `src/app/(workspace)/<entity>/layout.tsx` with SecondaryNav + drawer slot + `export const dynamic = "force-dynamic"`
   - `page.tsx` (list, uses EntityTable shell)
   - `[id]/page.tsx` (full detail)
   - `@drawer/default.tsx` + `@drawer/(.)[id]/page.tsx` (drawer detail)
   - `loading.tsx` with TableSkeleton
7. **Detail body**: `src/components/<entity>/<entity>-detail.tsx` shared between full page and drawer
8. **Popover route**: `src/app/api/popover/<entity>/[id]/route.ts`
9. **Pill component**: `src/components/shared/entity-pill.tsx` (extend with `<entity>Pill`)
10. **Primary nav**: add a `PrimaryNavLink` in `src/components/shell/primary-nav.tsx`

## Next.js 16 gotchas

- `params` and `searchParams` are Promises in pages and route handlers. Always `await props.params` / `await props.searchParams`.
- Use `PageProps<"/path">` type helper from generated route types.
- `next lint` is gone. Use `eslint` directly (we do via `npm run lint`).
- Turbopack is the default. `--turbopack` flag no longer needed.
- Dev cache lives in `.next/dev/`. If you see `Cannot find module '.next/dev/...'` errors, kill `next dev` and `rm -rf .next` and restart.
- Intercepting routes: `(.)foo` matches at the same level. `@slot` parallel routes require a `default.tsx`.
- `force-dynamic` may be needed on layouts that read DB or use client `useSearchParams`. We use it on every section layout.

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
| Ticket | `tkt_<nanoid>` | `helpdeskExternalId` (numeric string) | n/a | All seeded helpdesk='zendesk' |
| Customer | `cus_<nanoid>` | none yet | <3 red, <4 amber | First 3 are detractor companies (Hooli, Globex, Umbrella) |
| Team member | `tm_<nanoid>` | none yet | <3.5 red, <4 amber | 4 seeded as low performers |
| Response | `rsp_<nanoid>` | none yet | follows customer thresholds | `answers` JSON has rating + multi-choice + multi-select + comment |
| QA Evaluation | `qa_<nanoid>` | (schema exists, no data) | — | Strategic placeholder for phase 4+ |

## Don't do

- Don't reintroduce the sticky-first-column behavior; Cory will spec a configurable version later.
- Don't add per-cell text-size classes inside pills — they should match the parent table's `text-sm`.
- Don't fetch popover data on pill mount — it has to be lazy via the `EntityPopoverBody` inside `HoverCardContent`.
- Don't write JSX in `src/lib/` files unless they're `.tsx` AND marked `"use client"`.
- Don't use `${schema.table.column}` inside a correlated SQL subquery (see Conventions).
- Don't embed ad-hoc tables in detail pages. Use EntityTable.

## See also

- `README.md` — surface-level quickstart
- `DECISIONS.md` — explicit assumptions made along the way
- `REPORTS.md` — phase 4 pivot table plan
- `AGENTS.md` — Next.js 16 warning (read before writing route code)
