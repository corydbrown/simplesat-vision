@AGENTS.md

# Simplesat Vision — agent guide

A clean-room prototype of the future Simplesat product (customer-feedback platform). Not connected to production. Intended as a high-fidelity team alignment artifact, NOT a hacked demo — every change should reinforce a pattern you'd want a team of engineers to copy.

**Seed narrative**: mid-market B2C beauty retailer "Bloom Beauty" (Sephora-style). Three-tier loyalty program (Insider / Gold / Elite). ~95% individual consumers, ~5% B2B accounts (wholesale / corporate gifting / influencer). Simplesat is the underlying product — Bloom Beauty is the demo brand whose customer data flows through it.

## File map

- [ARCHITECTURE.md](ARCHITECTURE.md) — file layout, core abstractions (Property registry, EntityTable, Drawer, Filter system, Ticket Activity, Reports)
- [DESIGN.md](DESIGN.md) — design tokens (colors, typography, borders, states) + usage philosophy
- [DATA.md](DATA.md) — entity quick-ref, seed scale, custom attribute model, topic taxonomy, content banks
- [COOKBOOK.md](COOKBOOK.md) — recipes for adding a property, view, entity, filter, or pivot field
- [REPORTS.md](REPORTS.md) — pivot editor details, AI prompt-to-config
- [DECISIONS.md](DECISIONS.md) — explicit assumptions made along the way
- [AGENTS.md](AGENTS.md) — Next.js 16 gotchas (loaded automatically)
- [README.md](README.md) — surface-level quickstart

If you only read one section of this file: read **Conventions** and **Don't do**.

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

- **Supervisor:** `pwd` ends in `/simplesat-vision`, branch is `main`. Plans, reviews PRs, merges, edits docs, spawns worktrees.
- **Worker:** `pwd` is a sibling worktree (e.g. `/simplesat-vision-worktrees/<feature>/`), branch is `feat/*` or `docs/*`. Implements the task, commits, and (when ready) pushes + opens a PR.
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
- Skip for trivial work (typo fix, single-line tweak, pure questions). Use judgment.
- This block goes AFTER the normal task summary, not instead of it.

## Stack lock-in

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) |
| Lang | TypeScript strict |
| Styling | Tailwind v4 + shadcn/ui (Radix-based, copy-paste components) |
| Data | Drizzle ORM + better-sqlite3, local file at `db/simplesat.db` |
| Tables | Custom EntityTable (TanStack-free) driven by Property registry |
| DnD | dnd-kit (column reorder; pivot editor) |
| Charts | Recharts (reserved for future Reports phase) |
| Icons | Lucide |
| Font | Lato via `next/font/google`, with system stack fallback |
| Seed | Faker, deterministic via `faker.seed(42)` |
| Deploy target | Vercel (would swap to Turso/libSQL for SQLite hosting) |

**Do not** add: state management libraries, CSS-in-JS, testing setup, auth, or Storybook (Storybook hides drift by isolating components — the audit page surfaces drift by putting everything side by side; revisit once the design system stabilizes and someone besides Cory is building UI).

## Conventions

- **Component reuse > custom CSS**. Three layers: (1) Radix / dnd-kit / Recharts primitives — don't touch, (2) shadcn wrappers in `src/components/ui/` — don't edit, only add via shadcn CLI, (3) domain components in `src/components/shared/` — compose ui/ + behavior + your data shapes. Never write a custom component from scratch when an existing shadcn primitive composes. No negative-margin tricks, custom scroll/animation logic, or hand-rolled keyboard handling unless the primitive truly doesn't exist.
- **Slot APIs over prop explosion**. When a shared component has stable structure but variable content (toolbars, headers, list rows), use named slot props (`leading`, `trailing`, `actions`) or compound components (`<PropertyList.Group>`) — never accept a dozen booleans toggling internal regions. Radix's `asChild` is the standard escape hatch for swapping the underlying element.
- **Component-per-file in `shared/`**: anything reused twice becomes its own file in `src/components/shared/`.
- **No reinventing components inline.** If you need a visual that already exists as a component (badge, pill, kbd, tag, etc.), use the existing component. Don't hand-roll a one-off span with utility classes that recreates the shape. Pattern to avoid: inline `<span className="text-[10px] uppercase tracking-wider">DEMO</span>` instead of `<Badge>`. Twice = it's a component.
- **No raw Tailwind hue classes.** No `bg-red-50`, `text-emerald-700`, `border-amber-300`. Reach for production hue tokens instead (`bg-red-lighter`, `text-green-dark`, `border-yellow-light`). Tailwind's default palette doesn't match the production palette and isn't theme-flippable. See [DESIGN.md](DESIGN.md) → "Production hue palette".
- **No `any`**. Strict TypeScript.
- **Server Components by default**. Use `"use client"` only when you need hooks (useState, useEffect, useSearchParams), browser APIs (localStorage), or event handlers.
- **URL is the state container** for sort, pagination, view filter, tab, layout toggle, drawer open/closed, in-drawer tab, ad-hoc filters (`?f=`), report config (`?r=`). localStorage is for *preferences* (column widths/visibility/order, drawer width, sidebar width/collapsed, section collapsed-state, recent pages).
- **No `<a>` tags** for internal navigation. Use Next `Link`.
- **No date/number libraries**. Use `Intl.*` via `src/lib/format.ts` (includes `formatRelative`, `formatSmartTime`, `formatTimelineDay`).
- **No em dashes** in user-facing copy.
- **Font sizes** (production ladder — accessibility over density; see [DESIGN.md](DESIGN.md) → Typography for the full table):
  - Body, nav, detail values, property labels, table cells & headers, drawer body, feed card content, ticket message bubble body: `text-base` (15px — Tailwind's `text-base` is **overridden** from its default 16px in [`globals.css`](src/app/globals.css))
  - Stateful pills (status, priority, channel, tier), chat-message metadata: `text-sm` (14px — Tailwind default)
  - `kbd`, rare tight chrome: `text-xs` (12px — Tailwind default, used sparingly)
  - Entity name in detail header: `text-3xl` (30px)
  - **De-emphasis is via muted color, not smaller size.** A secondary label uses `text-muted-foreground` at body size before reaching for a smaller step. Color contrast does the work in most cases.
  - **No arbitrary text sizes.** No `text-[10px]`, `text-[14px]`, `text-[0.8rem]`, etc. Map to a ladder step or document a new step.
- **No forced uppercase** on property names, group labels, section titles, or column headers. Natural sentence case throughout.
- **Value font color rule** (applied across all property registries):
  - `text-foreground` — primary identifiers that answer *"what is this row?"*: name, subject, company, tags, comment text, primary answer values
  - `text-muted-foreground` — secondary metadata that *qualifies* the row: emails, IDs, counts, dates, "Unassigned", helpdesk source, answer types
  - Colored pill — *stateful* values: status, channel, tier, rating, survey state
- **Pill component model**:
  - `CustomerPill`, `TeamMemberPill`, `TicketPill`, `ResponsePill` (with `id`), `SurveyPill` — wrapped in HoverCard, render a `<DrawerLink>`, click opens drawer (cmd-click → standalone full page)
  - `CompanyPill` — text only, no padding, no popover, no link (company is a string, not yet an entity)
  - `ResponsePill` (without `id`) — plain `<span>`, rating + stars only; used as static value display
  - All interactive pills have a persistent `bg-accent/40` tint + always-visible `ArrowUpRight` arrow icon so they read as obviously clickable. Hover deepens the tint. Don't make them invisible-until-hover.
  - Interactive pills use `-mx-1 px-1` so their hover background extends slightly past the text without indenting the text relative to the column header.
- **EntityTable in drawers**: pass `pageSize = rows.length` to disable pagination. Use a distinct `tableId` (e.g., `customer-tickets`). When the table sits inside a drawer, pass `paramPrefix="d"` and `drawerEntity="<row entity>"` so row click opens a drawer for the inner row entity without clobbering the outer page's URL state.
- **EntityTable on list pages**: pass `drawerEntity="<entity>"` so any click on a row body opens the drawer. Pills inside the row keep their own click behavior.
- **Topbar slots**: `<Topbar crumbs={...} actions={<DetailActions ... />} />`. Detail pages always pass actions; list pages don't.
- **DrawerLink must forwardRef + spread props**: it's used as an `asChild` target of Radix `HoverCardTrigger`. If it doesn't forward ref or spread `...rest`, Radix can't inject pointer handlers and popovers silently break.
- **Aggregate subqueries in Drizzle**: do NOT use `${schema.table.column}` interpolation inside a `sql\`\`` correlated subquery — it produces a parameter placeholder, not a column reference, and you get NULL rows. Use literal `"table.column"` SQL instead. See `listCustomers` for the right pattern.
- **Cursor pointer everywhere actionable**: shadcn's `Button` doesn't include `cursor-pointer` by default. Add it to any button, link, or `[role="button"]` that's interactive.

## Keyboard shortcuts

| Key | Action | Where |
|---|---|---|
| `⌘\` | Toggle sidebar | Anywhere (registered in SidebarProvider) |
| `⌘K` | Open search palette | Anywhere |
| `⌘L` | Copy entity link | Anywhere DetailActions is mounted |
| `⌘⏎` | Open drawer entity in full page | Drawer only |
| `Esc` | Close drawer | Drawer only |

## Don't do

- **Don't reintroduce SecondaryNav.** Views live in PrimaryNav now. Section layouts are pass-throughs.
- **Don't put view counts in the nav.** Cleaner without them; totals live on the list page.
- **Don't reach for `useEffect` for the drawer close animation.** It runs after the unmount check. The exit snapshot must be captured synchronously during render. See [ARCHITECTURE.md](ARCHITECTURE.md) → "Drawer architecture → Animation".
- **Don't add a SecondaryNav-style left column on detail pages.** Standalone detail = 2-col grid with sidebar right (not left).
- **Don't reintroduce the sticky-first-column behavior**; Cory will spec a configurable version later.
- **Don't add per-cell text-size classes inside pills** — stateful pills set their own `text-sm` internally; don't override from the call site.
- **Don't fetch popover data on pill mount** — it has to be lazy via `EntityPopoverBody` inside `HoverCardContent`.
- **Don't write JSX in `src/lib/` files** unless they're `.tsx` AND marked `"use client"`.
- **Don't use `${schema.table.column}` inside a correlated SQL subquery** (see Conventions).
- **Don't embed ad-hoc tables in detail pages.** Use EntityTable.
- **Don't bring back the `@drawer` parallel-route folders** or the `rowHrefBase` prop on EntityTable. Drawer is search-param controlled; row navigation goes through `drawerEntity`. See DECISIONS.md "Phase 4".
- **Don't force uppercase on labels** (`uppercase tracking-*` on property names, group labels, section titles, or column headers).
- **Don't add vertical column borders** (`border-r`) to tables — only horizontal row dividers.
- **Don't render an entity's internal id in a detail-page header.** It's still in the properties panel under "Identity".
- **Don't use `text-xs` for body copy, labels, or section headings.** `text-xs` is for `kbd` and rare tight chrome only. For de-emphasis, use `text-muted-foreground` at body size.
- **Don't introduce raw Tailwind hue classes** (`bg-red-50`, `text-emerald-700`, etc.) — they bypass the production palette and won't theme-flip. Use production hue tokens (`bg-red-lighter`, `text-green-dark`, etc.).
- **Don't hand-roll inline visuals that recreate an existing component.** If the visual you're building looks like a pill, badge, kbd, or tag, use the existing primitive.
- **Don't lock body scroll when the drawer opens.** Background remains scrollable by design.
- **Don't add Surveys to the primary nav.** It's a first-class entity for pill/popover/drawer/pivot purposes, but management belongs in settings. The standalone `/surveys/[id]` page exists; there is intentionally no `/surveys` list route.
- **Don't invent topics.** The taxonomy in `src/lib/topics.ts` mirrors production. New topics arrive via `csv_exports/topics_groups.csv`.
- **Don't ship real customer comments.** `db/comments.json` and `db/ticket-messages.json` are hand-curated synthetic copy — keep them that way. If reseeding for a different vertical, rewrite the banks from scratch rather than harvesting from real exports.
- **Don't add a `source` field to `CustomFieldDef`** or render "Synced from X" anywhere. Simplesat cannot attribute custom-attribute values to a specific integration; that grouping was a fiction. Use the free-text semantic `group` for organizing custom attributes in the UI.
- **Don't add a `property_definitions` DB table for custom attributes.** Keep them in `src/lib/properties/custom-fields.ts` so importance/group/sample can be hand-tuned for the demo narrative.
- **Don't add a `companies` / `organizations` entity.** Organization data is rolled up onto the customer (`customers.company`, `companyExternalId`, `companyDomain`). Per Cory: lookup chains via the help desk make a dedicated entity unnecessary at this scope.
- **Don't add Storybook yet.** Storybook hides drift by isolating components. The audit surface (planned `/design` page) surfaces drift by putting everything side by side. Storybook becomes the right answer later when the design system has stabilized and someone besides Cory is building UI here.
