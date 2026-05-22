# Design tokens

Single source of truth for color, typography, and state values. Every visual change should be a token edit here (and a CSS var edit in [`src/app/globals.css`](src/app/globals.css)) — **never** a component edit.

Pairs with [`CLAUDE.md`](CLAUDE.md) → **Conventions** → "Font sizes" / "Value font color rule" (per-element typography rules) and [`ARCHITECTURE.md`](ARCHITECTURE.md) (where the tokens get consumed).

## Architecture

Three layers, top to bottom. Each layer has a single responsibility; the chain is unidirectional.

1. **Raw values** — CSS custom properties in `:root` (and `.dark`) inside `globals.css`. Hex, oklch, or `var()` references. **This is the only place values live.**
2. **Theme aliases** — `@theme inline { --color-foo: var(--foo); }` in the same file. Tailwind v4 reads this block and auto-generates utilities: `--color-foo` → `bg-foo`, `text-foo`, `border-foo`, `ring-foo`, etc.
3. **Consumption** — components reference Tailwind utilities only (`bg-blue`, `text-foreground`, `border-grey-light`). **No hex literals, no `font-family` declarations, no inline `style` for design values, no raw Tailwind hue classes (`bg-red-50`, `text-emerald-700`).**

**Changing a token = one line in `:root`.** Components update on the next reload. No imports to update, no theme provider to wire.

## Two-tier token system

Layer 1 above splits into **two tiers**:

- **Tier 1 — Production hue palette.** Raw color values. Seven chromatic hues × 5 shades, plus `--black` / `--white`. These are the source of truth. Most shades are absolute (no dark-mode override); the `-lighter` / `-darker` pair flips in dark mode because they back the pill bg+fg pair (`bg-{hue}-lighter text-{hue}-darker`). Call sites can consume any shade directly (`bg-blue-lighter`, `text-red-dark`).
- **Tier 2 — Structural-semantic aliases.** Tokens like `--foreground`, `--background`, `--border`, `--card` that name a *structural role* rather than a *color*. These flip per mode (light vs dark). They alias to Tier 1 hues — when you change a hue, the alias updates everywhere.

**State-semantic tokens are intentionally avoided.** Earlier iterations had `--positive` / `--negative` / `--neutral` / `--info` aliasing to mood-bearing values. That conflated "what state this is" with "what color this is" — and forced the codebase to label green as "positive" even when green was just being decorative. Pills and status indicators now reach into the hue palette directly (`bg-green-lighter` for solved, `bg-red-lighter` for urgent). If a true alias becomes worthwhile later (e.g., a `--success` token used in 20+ sites), revisit then.

## Typography

Loaded via `next/font/google` in [`src/app/layout.tsx`](src/app/layout.tsx):

```tsx
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato" });
// <html className={`${lato.variable} ...`}>
```

`--font-lato` flows into `--font-sans` in `globals.css`, which Tailwind exposes as `font-sans`. The fallback stack (`-apple-system`, etc.) remains so the prototype still renders if the web font fails.

**To swap fonts** (e.g., back to system, or to Inter / Geist): change the `Lato` import in `layout.tsx` and the `variable` name; nothing else.

### Size ladder

| Class | px | Use |
|---|---|---|
| `text-lg` | 18 | Centerpiece content — chat-message bubble body, response feed-card comment text |
| `text-base` | 15 | Body, nav, table cells & headers, property labels, drawer body, detail body |
| `text-sm` | 14 | Stateful pills (status, priority, channel, tier), chat-message metadata, filter/toolbar chrome |
| `text-xs` | 12 | `kbd`, avatar initials, popover chips, rare tight chrome (used sparingly — prefer muted color over smaller size) |
| `text-2xl` | 24 | Section H1 on dashboards (e.g., workspace home) |
| `text-3xl` | 30 | Entity name in detail header |

**Implementation:** `--text-base` is overridden to 15px in `globals.css`'s `@theme inline` block. `--text-sm`, `--text-xs`, and `--text-lg` use Tailwind v4 defaults (14px, 12px, 18px).

**De-emphasis is via color, not size.** If a label needs to read as secondary, use `text-muted-foreground` (or a muted hue alias) at the same size as body text. Going smaller is the last resort — color contrast does the work in most cases. Production tools (Notion, Linear, GitHub) almost never drop body labels below 14px.

### Forbidden

- **Arbitrary text sizes** (`text-[10px]`, `text-[14px]`, `text-[0.8rem]`, etc.). Map to a ladder step or document a new step.
- **Forced uppercase + tracking** on labels (`uppercase tracking-wide`). Sentence case throughout.
- **Using a smaller text size to de-emphasize** when muted color would do.

## Production hue palette (Tier 1)

Seven chromatic hues × five shades + black + white. Source of truth — every other color token aliases or composes from these.

Tailwind utilities are generated for each: `bg-blue`, `text-blue-dark`, `border-red-lighter`, `ring-purple`, etc.

**Most shades are absolute** — base, `-light`, `-dark` do NOT flip per mode. They power charts, icons, and primary actions that already work on a dark canvas.

**Exception: `-lighter` and `-darker` flip in dark mode.** They're consumed as pill bg+fg pairs (`bg-{hue}-lighter text-{hue}-darker`). Without the flip, stateful pills would render as light pastels on a dark canvas — washed-out and low-contrast. The pill components themselves contain zero conditionals; the variables resolve differently per theme.

### Neutral

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--black` | `#373F46` | (same) | Production "Black" — primary text body. Intentionally not pure `#000`. |
| `--white` | `#FFFFFF` | (same) | Pure white. |
| `--grey-darker` | `#4E616C` | `#C5CDD5` | Heaviest non-black text/border. Flips in dark mode (pill fg). |
| `--grey-dark` | `#596A82` | (same) | Secondary text alternative. |
| `--grey` | `#8D9399` | (same) | Tertiary text, mid-strength borders. |
| `--grey-light` | `#DEE6F0` | (same) | Soft borders, inactive elements. |
| `--grey-lighter` | `#F4F7F9` | `#2E353D` | Section backgrounds, pill bg. Flips in dark mode. |

### Blue

| Token | Light | Dark |
|---|---|---|
| `--blue-darker` | `#003F80` | `#99C7FF` |
| `--blue-dark` | `#0071E6` | (same) |
| `--blue` | `#007EFF` | (same) |
| `--blue-light` | `#66B2FF` | (same) |
| `--blue-lighter` | `#E6F2FF` | `#0A2640` |

### Green

| Token | Light | Dark |
|---|---|---|
| `--green-darker` | `#1E5D33` | `#A5E4B8` |
| `--green-dark` | `#2A8449` | (same) |
| `--green` | `#43BE64` | (same) |
| `--green-light` | `#7AD99A` | (same) |
| `--green-lighter` | `#D3F8DF` | `#1A3D26` |

### Red

| Token | Light | Dark |
|---|---|---|
| `--red-darker` | `#920111` | `#FFA5B0` |
| `--red-dark` | `#B70215` | (same) |
| `--red` | `#D00218` | (same) |
| `--red-light` | `#FF7989` | (same) |
| `--red-lighter` | `#FFD5E1` | `#4D0814` |

### Purple

| Token | Light | Dark |
|---|---|---|
| `--purple-darker` | `#4D2E78` | `#C7AAF5` |
| `--purple-dark` | `#723BC0` | (same) |
| `--purple` | `#804DC8` | (same) |
| `--purple-light` | `#BE9AF5` | (same) |
| `--purple-lighter` | `#F0E3F9` | `#2E1A4D` |

### Teal

| Token | Light | Dark |
|---|---|---|
| `--teal-darker` | `#008DA6` | `#99E0EB` |
| `--teal-dark` | `#00A8C2` | (same) |
| `--teal` | `#00C7E6` | (same) |
| `--teal-light` | `#83F5FF` | (same) |
| `--teal-lighter` | `#E6FCFF` | `#0A3640` |

### Yellow

| Token | Light | Dark |
|---|---|---|
| `--yellow-darker` | `#664400` | `#FFD68A` |
| `--yellow-dark` | `#F2A200` | (same) |
| `--yellow` | `#FBBD08` | (same) |
| `--yellow-light` | `#FFC86D` | (same) |
| `--yellow-lighter` | `#FFEED5` | `#3D2B00` |

### Hover / pressed states

Production convention: hover = next-darker step. Pressed = two steps darker. Use the explicit darker tokens rather than `bg-X/N` opacity tricks.

| State | Pattern |
|---|---|
| Default | `bg-blue` |
| Hover | `bg-blue-dark` |
| Pressed / active | `bg-blue-darker` |

The same pattern applies across all chromatic hues. Avoids the legibility issues of opacity-based hover (text contrast can degrade).

## Structural-semantic aliases (Tier 2)

These name *roles* (foreground, background, border). They alias Tier 1 hues and flip per mode. Listed below are the current values; many still hold their pre-palette hex literals and will be migrated to alias Tier 1 hues in a follow-up — see "Migration notes" at the bottom.

### Surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#FFFFFF` (white) | `oklch(0.145 0 0)` | Body canvas |
| `--card` | `#FFFFFF` (white) | `oklch(0.205 0 0)` | Elevated surfaces — cards, drawer body |
| `--popover` | `#FFFFFF` (white) | `oklch(0.205 0 0)` | Radix portals (HoverCard, Dropdown, Tooltip) |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Subtle fill: `kbd`, dashed "coming soon" panels |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Secondary buttons |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Pill hover tint (`bg-accent/40`) |
| `--canvas` | `#f4f4f4` | `oklch(0.12 0 0)` | Page-canvas grey. **Available but not yet applied** — see "Migration notes". |

### Text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--foreground` | `var(--black)` | `oklch(0.985 0 0)` | Primary text. |
| `--muted-foreground` | `#373f46cc` (80%) | `oklch(0.708 0 0)` | Secondary metadata (emails, IDs, dates). |
| `--foreground-light` | `#373f4673` (45%) | `#ffffffb2` | Tertiary text / hints. Rarely needed. |
| `--foreground-disabled` | `#373f4633` (20%) | `#ffffff33` | Disabled controls. |

### Borders & focus

| Token | Light | Dark | Use |
|---|---|---|---|
| `--border` | `#373f461a` (10%) | `oklch(1 0 0 / 10%)` | Default subtle border. |
| `--border-strong` | `#373f4633` (20%) | `oklch(1 0 0 / 20%)` | Emphasis border. |
| `--border-solid` | `#d4d4d5` | `#555555` | Opaque divider for non-white surfaces. |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | Form input border. |
| `--ring` | `var(--blue)` | `var(--blue)` | Focus ring (mirrors `--primary`). |

### Selection / highlight

| Token | Value | Use |
|---|---|---|
| `--selection` | `#cce2ff` (light) / `#003a7a` (dark) | Selected row / text-highlight background. |
| `--selection-foreground` | `var(--foreground)` | Text over `--selection`. |

### Primary

| Token | Value | Use |
|---|---|---|
| `--primary` | `var(--blue)` | Primary actions, focus rings, active nav. |
| `--primary-foreground` | `oklch(0.985 0 0)` | Text on primary. |
| `--primary-hover` | `var(--blue-dark)` | Hover state. |
| `--primary-down` | `var(--blue-darker)` | Pressed state. |
| `--destructive` | `var(--red-dark)` | Destructive actions (Delete buttons, dangerous menu items). Kept as a structural alias because "destructive button" is a real role. |

## Nav section icons

Purely decorative palette — one hue per primary nav entity so the sidebar reads scannable. **No semantic weight** beyond "this row is about X."

| Token | Value | Section |
|---|---|---|
| `--icon-responses` | `var(--blue)` | Responses |
| `--icon-customers` | `var(--purple)` | Customers |
| `--icon-team-members` | `var(--teal)` | Team members |
| `--icon-tickets` | `var(--yellow-dark)` | Tickets (mustard/amber — the closest warm palette hue to the original orange) |
| `--icon-reports` | `var(--green)` | Reports |

All five hues come from the production palette; every nav row reads as a distinct color. Previously customers (pink) and tickets (orange) were off-palette one-offs; migrated to `--purple` and `--yellow-dark` in the post-codification sweep.

## Chart palette (Recharts)

Multi-series order, now backed by Tier 1 hues:

| Token | Source | Use |
|---|---|---|
| `--chart-1` | `var(--blue)` | Series 1 — primary |
| `--chart-2` | `var(--green)` | Series 2 |
| `--chart-3` | `var(--yellow)` | Series 3 |
| `--chart-4` | `var(--red)` | Series 4 |
| `--chart-5` | `var(--purple)` | Series 5 |
| `--chart-6` | `var(--teal)` | Series 6 (added) |

Grid lines: `var(--border)`. Axis labels: `text-muted-foreground` (note: not `text-xs`). Tooltip: white, `rounded-lg`, default border. No titles inside charts — title lives in the card header.

Previously these were greyscale `oklch` defaults from shadcn's CLI installation — unused, unintentional. Now they point at production hues so when Reports ships, the colors are already correct.

## Usage philosophy

The tables above own *values*. This section owns *when to reach for which token* — guidance that doesn't fit a table.

### Spacing rhythm

Base unit 4px. **Allowed values only:** `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. No `6`, `10`, `14`. Pick the nearest allowed value.

Defaults:
- Page outer padding: `24` (`32` on `≥xl`) — exposed as the `--spacing-gutter` token → `px-gutter` utility. Every workspace page-edge surface (topbar, list toolbar, filter row, table cells & headers, group bands, pagination, table skeleton) uses `px-gutter` so all left edges stack on the same vertical. Tune the value in [globals.css](src/app/globals.css), not in callsites.
- Card padding: `20`
- Section vertical gap: `32`
- Form field gap: `16`
- Drawer padding: `24`
- Detail page padding: `px-14 py-10` standalone / `px-10 py-7` in drawer

### Shadows

Borders-first product. Shadows only on Radix portals: HoverCard, Popover, DropdownMenu, Dialog, Toast. **Never on inline cards, table rows, list items, or pills.** Shadcn's portal defaults already match — don't override with new shadow utilities.

### Discipline rules

The audit page surfaced patterns where the design system was bypassed rather than the system itself being wrong. These rules tighten the discipline:

1. **If you need a visual that already exists as a component, use the component.** Don't hand-roll a one-off span that recreates a pill, badge, kbd, or other primitive. Examples of the anti-pattern: inline `<span className="text-[10px] uppercase tracking-wider">DEMO</span>` instead of `<Badge>`. Twice = it's a component.
2. **No raw Tailwind hue classes** (`bg-red-50`, `text-emerald-700`, `border-amber-300`). Reach for production hue tokens instead (`bg-red-lighter`, `text-green-dark`, `border-yellow-light`). Tailwind's default palette doesn't match the production palette and isn't theme-flippable.
3. **No arbitrary text sizes.** No `text-[10px]`, `text-[14px]`, `text-[0.8rem]`, etc. If the ladder doesn't have what you need, document a new step rather than inlining an arbitrary value.
4. **Smallness comes from muted color, not smaller text.** Default to body size + muted color for de-emphasis. Drop to a smaller step only when the surface is genuinely tight chrome (`kbd`, popover footer).

### When in doubt

1. Look at Notion or Slack first.
2. Check the prototype for an analogous pattern.
3. More whitespace over less.
4. Fewer font sizes over more.
5. Border over shadow.

## Migration notes

**Landed in the codification PR (#13):**
- Production hue palette (`--black`, `--white`, 7 hues × 5 shades) added to `:root` and `.dark`.
- `@theme inline` exposes Tailwind utilities for every hue (`bg-blue`, `text-grey-dark`, etc.).
- Type ladder shifted: `text-base` overridden to 15px; `text-sm` reverts to Tailwind default 14px; `text-xs` stays at 12px.
- Chart series (`--chart-1..5` + new `--chart-6`) now alias the production hues. Previously greyscale shadcn defaults.
- Discipline rules documented in CLAUDE.md and echoed below.
- Decisions captured in [`DECISIONS.md`](DECISIONS.md).

**Landed in the mechanical sweep (this PR):**
- `--foreground`, `--primary`, `--primary-hover`, `--primary-down`, `--ring`, `--destructive` now alias Tier-1 hues (`--black`, `--blue`, `--blue-dark`, `--blue-darker`, `--red-dark`). `--foreground` shifts from `#373f46` to `#172B4D` — slightly darker navy.
- Stateful pill components (status / priority / channel / tier / team / team-group / survey status) migrated from raw Tailwind hues (`bg-red-50`, `bg-emerald-50`) to production hue tokens (`bg-{hue}-lighter text-{hue}-darker`). Pills bumped from `text-xs` to `text-sm` per [DECISIONS.md](DECISIONS.md) → decision 2.
- Deprecated `--positive` / `--negative` / `--neutral` / `--info` / `--brand` tokens removed from `:root`, `.dark`, and `@theme inline`. All consumers (ticket-activity timeline, audit page) migrated to production hue tokens.
- Nav icon palette migrated to production hues. `--icon-customers` (pink → `--purple`), `--icon-team-members` (purple → `--teal` to avoid collision), `--icon-tickets` (orange → `--yellow-dark`).
- Type ladder migration on call sites — `text-sm` → `text-base` in EntityTable cells/headers, property-list, topbar, primary-nav, drawer chrome, detail page values. Centerpiece `text-base` → `text-lg` in response feed-card comments and ticket-activity message bubbles. New `text-lg = 18` ladder step added.
- 25+ arbitrary `text-[Npx]` sites mapped to ladder steps. Avatar `sm`/`md` now use `text-xs`.
- Surfaced violations fixed: StatCard label (drop uppercase+tracking, use muted color at body size), PivotTable headers (text-xs → text-base, matches new EntityTable convention), DetailDrawer (remove `shadow-2xl` — drawer is an inline panel, not a Radix portal), Tabs primitive (remove active-state `shadow-sm`), columns-control category labels, audit-page Light/Dark labels.
- DEMO "Soon" inline spans replaced with `<Badge variant="secondary">` (workspace home + ticket detail). Outer purple-tinted wrappers migrated from raw Tailwind hues to `--purple-light` / `--purple-lighter` / `--purple-darker`.
- Star-rating + Avg-rating components migrated off raw Tailwind hues (`text-amber-400` → `text-yellow`; `text-red-600 / text-amber-600 / text-emerald-600` → `text-red-dark / text-yellow-dark / text-green-dark`).

**Body bg-canvas migration (declined 2026-05-22, SVP-18 — token retained):**
- `--canvas: #f4f4f4` exists but body intentionally stays on `bg-background` (flat-white). Layered grey-canvas + white-card was evaluated and declined — Simplesat is a data product; flat-white serves table-dense surfaces better. See DECISIONS.md → "Design system decisions". Token stays available so future re-evaluation is cheap.

## How to change a color

1. Edit the value in `:root` (and the matching `.dark` value if applicable) inside `src/app/globals.css`.
2. Reload. Done.

If a component is hardcoding a hex, that's a bug — fix it by routing the value through a token.

## How to add a new token

1. `:root { --my-token: <value>; }` in `globals.css` (and `.dark { --my-token: <value>; }` if it differs in dark mode).
2. `@theme inline { --color-my-token: var(--my-token); }` in the `@theme inline` block.
3. Use `bg-my-token` / `text-my-token` / `border-my-token` in components.

No Tailwind config, no theme provider, no codegen — Tailwind v4 reads the `@theme` block at build time.

## See also

- [`CLAUDE.md`](CLAUDE.md) → **Conventions** → "Font sizes" / "Value font color rule" — per-element type and color rules
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — where the tokens get consumed (Property registry, EntityTable, Drawer, etc.)
- [`DECISIONS.md`](DECISIONS.md) → "Design system codification" — the calls that produced this doc
- [`src/app/globals.css`](src/app/globals.css) — the actual var declarations
- [`src/app/layout.tsx`](src/app/layout.tsx) — `next/font/google` font loader
