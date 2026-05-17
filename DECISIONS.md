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
