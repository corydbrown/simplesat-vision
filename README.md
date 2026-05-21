# Simplesat Vision

High-fidelity prototype of where Simplesat is headed - the future product, running on realistic seeded data. Intended as an internal reference for the team to align on direction. Not connected to production.

**Seed narrative**: mid-market B2C beauty retailer "Bloom Beauty" (Sephora-style). Three-tier loyalty program (Insider / Gold / Elite). ~95% individual consumers, ~5% B2B accounts (wholesale / corporate gifting / influencer). Simplesat is the underlying product; Bloom Beauty is the demo brand whose customer data flows through it.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19.2 + TypeScript strict
- Tailwind CSS v4 + shadcn/ui (radix-nova preset, Lucide icons, Lato font via `next/font/google`)
- Custom `EntityTable` component (no TanStack — drag/resize/sort/show-hide built directly on dnd-kit + URL state)
- Drizzle ORM + better-sqlite3 (local file at `db/simplesat.db`)
- Faker for seed data
- dnd-kit (column reorder), Recharts (reserved for Reports phase)

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
- 1,200 customers, 25 team members across 6 groups, 50,000 tickets, ~14,200 responses, 50 tickets with full message + event timelines (351 messages, 289 events), 8 surveys. Stored in a local SQLite file. Queried server-side with Drizzle.
- Four list pages (Tickets, Customers, Team members, Responses) — saved views, sort, column show/hide, drag-to-reorder, column resize, pagination, ad-hoc filters via shared `<FilterRow />` (Tickets first; other lists follow).
- Detail drawer + standalone page for all entities. Drawer is URL-driven (`?drawer=<entity>:<id>`), opens from any page, swaps content in place, preserves back/forward.
- Hover popovers on every entity pill. Chat-style activity timeline on `/tickets/[id]`.
- Reports / pivot editor at `/reports` with AI prompt-to-config (`claude-haiku-4-5`).
- `⌘K` search palette with recent-pages section and entity avatars.

**Mocked / cosmetic**:
- Toolbar buttons that aren't wired (Group by, Export, New, drawer kebab actions) are visual only.
- QA Evaluations: schema exists but no seed data or UI beyond placeholder cards.

## Project layout

Top-level shape only — full annotated file tree lives in [ARCHITECTURE.md](ARCHITECTURE.md).

```
src/
  app/           # Next.js App Router routes + API endpoints
  components/    # shared/ (reused), shell/ (nav), <entity>/ (per-entity), ui/ (shadcn)
  db/            # schema, seed, queries
  lib/           # properties (registries), filters, reports, format, ids, topics
db/
  simplesat.db        # gitignored, regenerate with db:reset
  comments.json       # response comment bank (PII-scrubbed synthetic)
  ticket-messages.json # ticket message bank (PII-scrubbed synthetic)
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

## Docs

- [CLAUDE.md](CLAUDE.md) — agent guide: conventions, "don't do" list, file map for the rest of the docs
- [ARCHITECTURE.md](ARCHITECTURE.md) — file layout, core abstractions (Property registry, EntityTable, Drawer, Filter system, Reports)
- [DESIGN.md](DESIGN.md) — design tokens (colors, typography, borders, states) + usage philosophy
- [DATA.md](DATA.md) — entity quick-ref, seed scale, custom attributes, topic taxonomy, content banks
- [COOKBOOK.md](COOKBOOK.md) — recipes for adding a property, view, entity, filter, or pivot field
- [REPORTS.md](REPORTS.md) — pivot editor details, AI prompt-to-config
- [DECISIONS.md](DECISIONS.md) — explicit assumptions made along the way
- [AGENTS.md](AGENTS.md) — Next.js 16 gotchas
- [WORKFLOW.md](WORKFLOW.md) — worktree-per-task workflow
