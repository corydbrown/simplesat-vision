# Simplesat Vision

High-fidelity prototype of where Simplesat is headed - the future product, running on real seeded data. Intended as an internal reference for the team to align on direction. Not connected to production.

## Stack

- Next.js 16 (App Router) + React 19.2 + TypeScript strict
- Tailwind CSS v4 + shadcn/ui (radix-nova preset, Lucide icons, Geist font)
- TanStack Table v8 for the tickets grid
- Drizzle ORM + better-sqlite3 (local file at `db/simplesat.db`)
- Faker for seed data
- dnd-kit, Recharts available (used in phase 2)

## Quickstart

```bash
nvm use
npm install
npm run db:reset
npm run dev
```

Then open http://localhost:3000.

`db:reset` generates the Drizzle migration, applies it, and seeds ~50k tickets. The seed is deterministic.

The seed is deterministic (`faker.seed(42)`) so re-running `db:reset` produces identical data.

## Scripts

| Script | What it does |
|---|---|
| `dev` | Run the Turbopack dev server |
| `build` | Production build |
| `start` | Serve the production build |
| `lint` | Run ESLint |
| `db:generate` | Generate a new Drizzle migration from the schema |
| `db:migrate` | Apply pending migrations to `db/simplesat.db` |
| `db:seed` | Run the seed script |
| `db:studio` | Open Drizzle Studio against the local db |
| `db:reset` | Wipe the db file and re-run migrate + seed |

## What's mocked vs. real

**Real**:
- 500 customers, 25 team members, 50,000 tickets, ~14,000 responses, 50 tickets with real conversation threads. Stored in a local SQLite file. Queried server-side with Drizzle. All joins on the Tickets page are live.

**Mocked / cosmetic**:
- View tabs on the Tickets page (only "All tickets" is active)
- Toolbar buttons (Filter, Group by, Sort, Properties, Export, New) are visual only
- QA Evaluations: schema exists but no seed data or UI beyond the "Soon" cards
- Stub pages for Responses, Customers, Team members, Reports

## Project layout

```
src/
  app/
    (workspace)/      # routes that share the sidebar layout
      page.tsx        # home
      tickets/        # tickets list + detail
      responses/      # stub
      customers/      # stub
      team-members/   # stub
      reports/        # stub
    layout.tsx        # root layout (font, tooltip provider)
    globals.css       # tailwind + shadcn theme
  components/
    shell/            # sidebar, topbar, coming-soon
    tickets/          # table, columns, pills, toolbar, view tabs
    ui/               # shadcn components
  db/
    client.ts         # better-sqlite3 + drizzle singleton
    schema.ts         # all 5 tables
    seed.ts           # faker seed
    queries/          # typed query helpers
  lib/
    ids.ts            # prefixedId() using nanoid
    format.ts         # date/number/duration formatters
db/
  simplesat.db        # gitignored, regenerate with db:reset
drizzle/
  *.sql               # checked-in migrations
```

## Deployment notes

The SQLite file is local-only for phase 1. To deploy to Vercel, swap better-sqlite3 for Turso (libSQL) and update `src/db/client.ts` to use the libSQL driver. The Drizzle schema and queries do not need to change.

## Conventions

- No `any`. Strict TypeScript.
- Server Components by default; client only when interactivity is needed.
- URL `searchParams` for table sort/pagination - no client state library.
- No em dashes in user-facing copy.

## Decisions log

See `DECISIONS.md` for explicit assumptions made during the build that are open to discussion.

## Planning docs

- `REPORTS.md` — phase 4 plan for the Reports / pivot table feature.
