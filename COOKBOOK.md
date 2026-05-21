# Cookbook — adding a new \<thing\>

Recipes for the most common kinds of extension. Read [ARCHITECTURE.md](ARCHITECTURE.md) first so the moving parts are familiar.

## Add a property to an existing entity

1. Add it to `src/lib/properties/<entity>.tsx` with a `cell` render
2. Add a `detail` override if the table cell uses tight visuals (e.g. `font-mono text-xs`) that look out of place in the spacious property panel
3. If the data isn't on the row type, extend the query (`src/db/queries/<entity>.ts`)
4. Default visibility via `defaultVisible: true|false`
5. Add a `filter` descriptor if the property should be filterable on list pages — see `src/lib/properties/types.ts` for the shape

It appears immediately in: list table, detail PropertiesPanel, embedded tables, and the Responses feed (as a footer pill, if visible).

## Add a saved view

1. Add a `ViewDef` to `src/lib/views.ts` under the matching `<ENTITY>_VIEWS` array
2. Add a SQL where helper to `src/lib/view-predicates.ts` under `<entity>sViewWhere`
3. If the predicate touches a JOINed table, use `exists(subquery)` (see `tickets` "rated" / "detractors" view)

Sidebar nav picks it up automatically (PrimaryNav reads views.ts at server-render time).

## Add a new entity

1. **Schema**: add to `src/db/schema.ts`. `npm run db:generate` + `npm run db:migrate`.
2. **Seed**: update `src/db/seed.ts`. Run `npm run db:reset`.
3. **Queries**: new file `src/db/queries/<entity>.ts` — list query (view + sort + pagination + optional filter) and detail query.
4. **Property registry**: `src/lib/properties/<entity>.tsx`.
5. **Views**: `src/lib/views.ts` + `view-predicates.ts`.
6. **Routes**:
   - `src/app/(workspace)/<entity>/layout.tsx` — thin pass-through with `export const dynamic = "force-dynamic"`. No SecondaryNav.
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

## Add a filter field to a list page

1. Add a `filter` block to the relevant `Property<T>` entry in `src/lib/properties/<entity>.tsx` (data type, allowed ops if non-default).
2. Add the server-side column mapping to `src/lib/filters/fields/<entity>.ts` (Drizzle column ref + allowed ops).
3. Pass `filters` to the list query in `src/db/queries/<entity>.ts` (compose with view via `and(...)`).
4. The shared `<FilterRow />` picks it up automatically.

## Add a new pivot field to Reports

1. Add the field to `PIVOT_FIELDS[<base>]` in `src/lib/reports/pivot-fields.ts` with `groupExpr` / `labelExpr` / `joins` / `filterOps` / `valueOnly?` / `entity?`.
2. If it's a relation column whose `groupExpr` returns an entity id, set `entity: "<entity-name>"` so the pivot renderer emits the matching `EntityPill`.
3. If it requires JSON path access or a subquery, model it as a `valueExpr` (for values) or compose joins.

See [REPORTS.md](REPORTS.md) for deeper notes on the two-layer metadata system and the AI prompt-to-config flow.
