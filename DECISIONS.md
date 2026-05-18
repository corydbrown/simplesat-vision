# Decisions log

Assumptions and judgment calls made during the build. Items here were not explicitly specified by the original brief, but were chosen to keep momentum. Anything in this file is up for discussion.

## Stack and tooling

- **Next.js 16.2.6** (not 15). The brief said Next.js 15, but `create-next-app@latest` now installs 16 as the current stable. Next.js 16 brings two relevant breaking changes: `params` and `searchParams` are now Promises (must be awaited), and `next lint` is removed (we use ESLint's CLI directly via the `lint` script). Both are accommodated in the code.
- **React 19.2** (paired with Next 16).
- **Tailwind v4** with `@tailwindcss/postcss`, the create-next-app default.
- **shadcn/ui preset**: `radix-nova` (Lucide icons + Geist font), neutral base color, CSS variables, light mode default. Dark mode CSS variables are present so phase 2 can flip a class on `<html>` to support it.
- **Package manager**: npm. Only one installed locally; Vercel handles npm natively.
- **Node engines**: >=20 (current install is 25.8.1). Next.js 16 requires Node 20.9+.

## Data and IDs

- **Drizzle dialect**: `better-sqlite3` (synchronous driver). Drizzle config writes to `db/simplesat.db`. Migrations live in `drizzle/` and are checked in.
- **ID format**: `nanoid` (12-char URL-safe alphabet) with the prefixes from the brief: `cus_`, `tm_`, `tkt_`, `rsp_`, `qa_`.
- **JSON columns** (`tags`, `conversation`, `breakdown`): use Drizzle's `text({ mode: 'json' }).$type<...>()` for type-safe JSON.
- **Seed determinism**: `faker.seed(42)` so re-running `db:reset` produces the same data. Helpful for reviewer comparison.
- **Helpdesk distribution**: per direction from Cory mid-scaffold, **all seeded tickets are Zendesk**. The schema enum still includes gladly/gorgias/intercom for forward-compat, but no rows reference them.

## App structure

- **App Router** with `src/` and a `(workspace)` route group so the sidebar layout wraps all top-level routes (`/`, `/tickets`, `/responses`, etc.) without forcing the ticket detail route to also include it (it does, but cleanly).
- **State**: URL `searchParams` only for table sort/pagination. No state library, no client-side store.
- **Date/number formatting**: `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` in `src/lib/format.ts`. No `date-fns`, `dayjs`, etc.

## Scope cuts (phase 2)

- View tabs on the Tickets page render but only "All tickets" is active; the others are static.
- Toolbar (search, filter, group, sort, properties, export, new) is visual only in phase 1.
- Ticket detail is a full page route at `/tickets/[id]`, not a drawer. Drawer is phase 2.
- Customers / Team members / Responses / Reports pages are placeholder stubs.
- QA Evaluations: schema only; no seed data, no UI beyond the dashed "Coming Soon" card.
- No auth, no multi-tenant, no tests, no Storybook.

## Phase 3 decisions

- **Property registry**: each entity gets a single `properties.tsx` registry that powers both the list table AND the detail PropertiesPanel. Same source of truth; separate visibility persistence per `tableId`.
- **Properties visibility**: list view (`tableId="<entity>"`), detail panel (`tableId="<entity>-detail"`), and embedded tabs (`tableId="<entity>-tickets"`, etc.) each have separate column state in localStorage. User can show/hide independently per context (Notion-like).
- **Drawer architecture**: Next.js parallel intercepting routes (`@drawer/(.)[id]`). Same `<EntityDetailBody>` powers both the standalone `/<entity>/[id]` page (direct nav) and the drawer (intercepted from list). No backdrop; left-side resize handle; close via X / Esc / outside click (outside-click ignores clicks on links/buttons so opening another entity's drawer from inside the current one works).
- **No sticky columns**: removed for now per Cory's feedback. To be reintroduced as user-configurable, not registry-hardcoded.
- **CompanyPill**: text only, no colored dot, no popover. Company is a string on Customer, not a first-class entity (yet).
- **Hover popover lifecycle**: lazy-mount only when `HoverCardContent` opens (Radix unmounts content on close by default). Module-level cache means each entity is fetched at most once per session. Critical for not firing 100+ fetches on every list page load.
- **Aggregate subqueries**: use literal `"<table>.<column>"` SQL inside `sql\`\`` correlated subqueries. `${schema.table.column}` interpolates as a parameter placeholder bound to nothing → NULL rows. (Bit me hard on listCustomers / listTeamMembers in phase 2.)
- **Multi-question survey schema**: `responses.answers` JSON column with `SurveyAnswer` discriminated union. `responses.rating` and `responses.comment` stay denormalized for fast indexed filtering used by Views and insights.

## Phase 3 scope cuts

- Reports / pivot table: planning doc only (`REPORTS.md`); execution deferred.
- Search wired to DB: search input is visual-only.
- Filter chip builder: visual-only (Views cover most cases).
- Saved-view creation: still curated in `src/lib/views.ts`, not user-editable.
- QA Evaluations full mockup: still a "Soon" card.
