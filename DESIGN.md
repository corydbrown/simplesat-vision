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

- **Tier 1 — Production hue palette.** Raw color values. Seven chromatic hues × 5 shades, plus `--black` / `--white` / `--vanilla`. These are the source of truth. They do NOT change between light and dark mode. Call sites can consume them directly (`bg-blue-lighter`, `text-red-dark`) for any decorative or descriptive use.
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
| `text-base` | 15 | Body, nav, table cells & headers, property labels, drawer body, detail body |
| `text-sm` | 14 | Stateful pills (status, priority, channel, tier), chat-message metadata |
| `text-xs` | 12 | `kbd`, rare chrome (used sparingly — prefer muted color over smaller size) |
| `text-2xl` | 24 | Section H1 on dashboards (e.g., workspace home) |
| `text-3xl` | 30 | Entity name in detail header |

**Implementation:** `--text-base` is overridden to 15px in `globals.css`'s `@theme inline` block. `--text-sm` and `--text-xs` use Tailwind v4 defaults (14px and 12px).

**De-emphasis is via color, not size.** If a label needs to read as secondary, use `text-muted-foreground` (or a muted hue alias) at the same size as body text. Going smaller is the last resort — color contrast does the work in most cases. Production tools (Notion, Linear, GitHub) almost never drop body labels below 14px.

### Forbidden

- **Arbitrary text sizes** (`text-[10px]`, `text-[14px]`, `text-[0.8rem]`, etc.). Map to a ladder step or document a new step.
- **Forced uppercase + tracking** on labels (`uppercase tracking-wide`). Sentence case throughout.
- **Using a smaller text size to de-emphasize** when muted color would do.

## Production hue palette (Tier 1)

Seven chromatic hues × five shades + black + white. Source of truth — every other color token aliases or composes from these.

Tailwind utilities are generated for each: `bg-blue`, `text-blue-dark`, `border-red-lighter`, `ring-purple`, etc. Hues do NOT flip per mode — they are absolute values. Structural-semantic tokens (next section) flip per mode and alias these.

### Neutral

| Token | Hex | Notes |
|---|---|---|
| `--black` | `#172B4D` | Production "Black" — primary text body. Intentionally not pure `#000`. |
| `--white` | `#FFFFFF` | Pure white. |
| `--grey-darker` | `#4E616C` | Heaviest non-black text/border. |
| `--grey-dark` | `#596A82` | Secondary text alternative. |
| `--grey` | `#A5ADBA` | Tertiary text, mid-strength borders. |
| `--grey-light` | `#DEE6F0` | Soft borders, inactive elements. |
| `--grey-lighter` | `#F4F7F9` | Section backgrounds, hover tints. |

### Blue

| Token | Hex |
|---|---|
| `--blue-darker` | `#003F80` |
| `--blue-dark` | `#0058B3` |
| `--blue` | `#007EFF` |
| `--blue-light` | `#66B2FF` |
| `--blue-lighter` | `#E6F2FF` |

### Green

| Token | Hex |
|---|---|
| `--green-darker` | `#1E5D33` |
| `--green-dark` | `#2A8449` |
| `--green` | `#4EC677` |
| `--green-light` | `#7AD99A` |
| `--green-lighter` | `#D3F8DF` |

### Red

| Token | Hex |
|---|---|
| `--red-darker` | `#920111` |
| `--red-dark` | `#B10214` |
| `--red` | `#D00218` |
| `--red-light` | `#FF7989` |
| `--red-lighter` | `#FFDDE1` |

### Purple

| Token | Hex |
|---|---|
| `--purple-darker` | `#4D2E78` |
| `--purple-dark` | `#663EA0` |
| `--purple` | `#804DC8` |
| `--purple-light` | `#BE9AF5` |
| `--purple-lighter` | `#F0ECF9` |

### Teal

| Token | Hex |
|---|---|
| `--teal-darker` | `#008DA6` |
| `--teal-dark` | `#00B8D9` |
| `--teal` | `#00C7E6` |
| `--teal-light` | `#B3F5FF` |
| `--teal-lighter` | `#E6FCFF` |

### Yellow

| Token | Hex |
|---|---|
| `--yellow-darker` | `#664400` |
| `--yellow-dark` | `#F2A200` |
| `--yellow` | `#FBBD08` |
| `--yellow-light` | `#FFC86D` |
| `--yellow-lighter` | `#FFEFD5` |

### Vanilla

Production shipped only `--vanilla-darker` and `--vanilla-lighter`. The middle three are interpolated guesses (Claude) for symmetry with the other hues — tune as needed.

| Token | Hex | Note |
|---|---|---|
| `--vanilla-darker` | `#666100` | Production value. |
| `--vanilla-dark` | `#998C00` | Guess — interpolated. |
| `--vanilla` | `#CCBB33` | Guess — interpolated. |
| `--vanilla-light` | `#E6D87A` | Guess — interpolated. |
| `--vanilla-lighter` | `#FEFCD5` | Production value. |

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
| `--foreground` | `#373f46` | `oklch(0.985 0 0)` | Primary text. *Migration pending: alias to `--black`.* |
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
| `--ring` | mirrors `--primary` | mirrors `--primary` | Focus ring (use `ring-primary/30`). |

### Selection / highlight

| Token | Value | Use |
|---|---|---|
| `--selection` | `#cce2ff` (light) / `#003a7a` (dark) | Selected row / text-highlight background. |
| `--selection-foreground` | `var(--foreground)` | Text over `--selection`. |

### Primary

| Token | Value | Use |
|---|---|---|
| `--primary` | `oklch(0.585 0.22 252)` (≈ `--blue`) | Primary actions, focus rings, active nav. *Migration pending: alias to `--blue`.* |
| `--primary-foreground` | `oklch(0.985 0 0)` | Text on primary. |
| `--primary-hover` | `#0066e6` | Hover state. *Migration pending: use `--blue-dark`.* |
| `--primary-down` | `#0066cc` | Pressed state. *Migration pending: use `--blue-darker`.* |

### Deprecated — pending removal

These existed for state-semantic mapping; the decision is to drop them in favor of direct hue use. Kept until the mechanical sweep wires call sites to hues:

- `--positive` / `--positive-foreground`
- `--negative` / `--negative-foreground`
- `--neutral` / `--neutral-foreground`
- `--info` / `--info-foreground`
- `--brand` / `--brand-foreground` (was a brand-moment accent; production palette doesn't carry a separate brand token — use `--green` directly)
- `--destructive` (used 40+ times in the codebase; will alias to `--red` going forward — or stay as a structural alias)

## Nav section icons

Purely decorative palette — one hue per primary nav entity so the sidebar reads scannable. **No semantic weight** beyond "this row is about X."

| Token | Value | Section |
|---|---|---|
| `--icon-responses` | `#007eff` (`--blue`) | Responses |
| `--icon-customers` | `#e03997` | Customers — pink, NOT in the production palette (audit nit) |
| `--icon-team-members` | `#804dc8` (`--purple`) | Team members |
| `--icon-tickets` | `#f2711c` | Tickets — orange, NOT in the production palette (audit nit) |
| `--icon-reports` | `#43be64` (close to `--green`) | Reports |

Sourced from Simplesat `Site Colors/Colors/*`. Two of the five (customers, tickets) use orange / pink hues that aren't in the production palette — could be left as one-offs (decorative-only) or migrated to the palette. Defer.

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
- Page outer padding: `24` (`32` on `≥xl`)
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

State as of this codification PR:

**Landed in this PR (additive, no breakage):**
- Production hue palette (`--black`, `--white`, 7 hues × 5 shades, vanilla 5-shade) added to `:root` and `.dark`.
- `@theme inline` exposes Tailwind utilities for every hue (`bg-blue`, `text-grey-dark`, etc.).
- Type ladder shifted: `text-base` overridden to 15px; `text-sm` reverts to Tailwind default 14px; `text-xs` stays at 12px.
- Chart series (`--chart-1..5` + new `--chart-6`) now alias the production hues. Previously greyscale shadcn defaults.
- Discipline rules documented above.
- Decisions captured in [`DECISIONS.md`](DECISIONS.md).

**Pending (mechanical sweep, follow-up PR):**
- Migrate `--foreground`, `--primary`, `--primary-hover`, `--primary-down`, `--ring` to alias Tier 1 hues (currently hex literals that approximate `--black` / `--blue` / `--blue-dark` / `--blue-darker`).
- Migrate stateful pill components (status / priority / channel / tier / team / team-group / survey) from raw Tailwind hues (`bg-red-50`, `bg-emerald-50`, etc.) to production hue tokens (`bg-red-lighter`, `bg-green-lighter`, etc.).
- Remove deprecated `--positive` / `--negative` / `--neutral` / `--info` / `--brand` tokens after migrations land.
- Fix `text-xs` violations to the new ladder (`text-base` for body labels; `text-sm` for chrome that fits sm; `text-xs` rare).
- Kill arbitrary `text-[Npx]` one-offs (60+ occurrences) — map to ladder.
- Replace hand-rolled `<span className="...">DEMO</span>` and similar inline visuals with the `<Badge>` primitive.
- Decide whether `--brand` and `--primary-down` stay (likely no; their semantic now lives in `--green` / `--blue-darker`).

**Body bg-canvas migration (separate, deferred):**
- `--canvas: #f4f4f4` exists but body still uses `bg-background` (white). To switch to layered grey-canvas + white-cards: (1) change body to `bg-canvas` in `src/app/layout.tsx`, (2) audit `bg-background` panels (`src/app/(workspace)/page.tsx` dashboard section, `src/components/shell/topbar.tsx`) — they should become `bg-card`. Holding off until we've decided we want that look.

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
