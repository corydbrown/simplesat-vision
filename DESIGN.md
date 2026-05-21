# Design tokens

Single source of truth for color, typography, and state values. Every visual change should be a token edit here (and a CSS var edit in [`src/app/globals.css`](src/app/globals.css)) — **never** a component edit.

Pairs with [`CLAUDE.md`](CLAUDE.md) → **Conventions** → "Font sizes" / "Value font color rule" (per-element typography rules) and [`ARCHITECTURE.md`](ARCHITECTURE.md) (where the tokens get consumed).

## Architecture

Three layers, top to bottom. Each layer has a single responsibility; the chain is unidirectional.

1. **Raw values** — CSS custom properties in `:root` (and `.dark`) inside `globals.css`. Hex, oklch, or `var()` references. **This is the only place values live.**
2. **Theme aliases** — `@theme inline { --color-foo: var(--foo); }` in the same file. Tailwind v4 reads this block and auto-generates utilities: `--color-foo` → `bg-foo`, `text-foo`, `border-foo`, `ring-foo`, etc.
3. **Consumption** — components reference Tailwind utilities only (`bg-card`, `text-foreground`, `border-border-strong`). **No hex literals, no `font-family` declarations, no inline `style` for design values.**

**Changing a token = one line in `:root`.** Components update on the next reload. No imports to update, no theme provider to wire, no Storybook regen.

## Typography

Loaded via `next/font/google` in [`src/app/layout.tsx`](src/app/layout.tsx):

```tsx
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato" });
// <html className={`${lato.variable} ...`}>
```

`--font-lato` flows into `--font-sans` in `globals.css`, which Tailwind exposes as `font-sans`. The fallback stack (`-apple-system`, etc.) remains so the prototype still renders if the web font fails.

**To swap fonts** (e.g., back to system, or to Inter / Geist): change the `Lato` import in `layout.tsx` and the `variable` name; nothing else.

Per-element type rules (sizes, weights, when to use muted color vs smaller size) live in [`CLAUDE.md`](CLAUDE.md) → **Conventions** → "Font sizes" and "Value font color rule".

**Tailwind size override.** `text-sm` is redefined from Tailwind's default `0.875rem` / `1.25rem` (14/20) to `0.9375rem` / `1.375rem` (15/22) via `@theme inline` in `globals.css`. Rationale: 14px reads tight at our density, especially with Lato's narrower x-height. To revert to 14px, delete the `--text-sm` / `--text-sm--line-height` lines from `@theme inline` — no component edits needed.

## Color tokens

All names match Tailwind utility suffixes: `--color-foo` → `bg-foo` / `text-foo` / `border-foo` / `ring-foo`.

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--background` | `#ffffff` | Body canvas (today) |
| `--card` | `#ffffff` | Elevated surfaces — cards, drawer body, popovers' content frame |
| `--popover` | `#ffffff` | Radix portals (HoverCard, Dropdown, Tooltip) |
| `--muted` | `oklch(0.97 0 0)` | Subtle fill: `kbd`, dashed "coming soon" panels |
| `--secondary` | `oklch(0.97 0 0)` | Secondary buttons |
| `--canvas` | `#f4f4f4` | Simplesat workspace canvas grey. **Available but not yet applied** — see "Pending migrations" below. |

### Text

| Token | Value (light) | Use |
|---|---|---|
| `--foreground` | `#373f46` | Primary text. The "Black" of the Simplesat design system — intentionally not pure `#000`. |
| `--muted-foreground` | `#373f46` @ 80% | Secondary metadata (emails, IDs, dates, counts). Matches Simplesat's `hoveredTextColor` — chosen over 65% (`mutedTextColor`) so secondary text reads clearly at table density. |
| `--foreground-light` | `#373f46` @ 45% | Tertiary text / hints. Rarely needed. |
| `--foreground-disabled` | `#373f46` @ 20% | Disabled controls |

### Brand & primary

| Token | Value | Use |
|---|---|---|
| `--primary` | `#007eff` | Primary actions, focus rings, active nav, informational links |
| `--primary-hover` | `#0066e6` | Primary button hover state (when explicit, not opacity) |
| `--primary-down` | `#0066cc` | Primary button pressed state |
| `--brand` | `#43BE64` | Brand-moment accent only (logo, marketing flourish). **Not for primary actions.** |

### Status

For badges, semantic pills, inline state. Backgrounds are softer than Figma's `Emotive/*` palette — full-saturation looks loud at our density. **Don't substitute `--primary` for positive states.**

| Status | Background | Foreground |
|---|---|---|
| `--positive` / `--positive-foreground` | `#E8F7EC` | `#1E7A36` |
| `--negative` / `--negative-foreground` | `#FCE8E6` | `#A02E26` |
| `--neutral` / `--neutral-foreground` | `#FEF4E0` | `#8B6A14` |
| `--info` / `--info-foreground` | `#E6F0FB` | `#1E5A9C` |

### Borders

| Token | Value | Use |
|---|---|---|
| `--border` | `#373f461a` (10% black) | Default subtle border — cards, table rows, dividers |
| `--border-strong` | `#373f4633` (20% black) | Emphasis: selected pill, focused input outline |
| `--border-solid` | `#d4d4d5` | Opaque divider — use over non-white surfaces where translucent border would visually shift |
| `--input` | `oklch(0.922 0 0)` | Form input border (kept distinct so input-only changes don't ripple) |
| `--ring` | mirror of `--primary` | Focus ring (use `ring-primary/30` for the standard 2px @ 30% alpha) |

### Selection / highlight

| Token | Value | Use |
|---|---|---|
| `--selection` | `#cce2ff` | Selected row / text-highlight background (matches Simplesat's `highlightBackground`) |
| `--selection-foreground` | `#373f46` | Text over `--selection` |

### Nav section icons

Purely decorative palette — one hue per primary nav entity so the sidebar reads scannable. **No semantic weight** beyond "this row is about X." Don't reuse these tokens for status, charts, or pills; pick from `--primary` / `--brand` / status tokens for those.

| Token | Value | Section |
|---|---|---|
| `--icon-responses` | `#007eff` | Responses (matches `--primary` — responses are the workhorse entity) |
| `--icon-customers` | `#e03997` | Customers |
| `--icon-team-members` | `#804dc8` | Team members |
| `--icon-tickets` | `#f2711c` | Tickets |
| `--icon-reports` | `#43be64` | Reports |

Sourced from Simplesat `Site Colors/Colors/*`. Consumed via `text-icon-<section>` Tailwind utilities — the nav data definition in `src/components/shell/primary-nav.tsx` carries an `iconClass` field per section.

### Chart palette (Recharts)

Multi-series order:
1. `#007eff` primary blue
2. `#43BE64` brand green
3. `#F4B942` neutral yellow
4. `#E4574C` negative red
5. `#9F7AEA` purple (only if 5+ series)
6. `#8D9399` muted grey

Grid lines: `var(--border)`. Axis labels: `text-muted-foreground text-xs`. Tooltip: white, `rounded-lg`, default border. No titles inside charts — title lives in the card header.

## Usage philosophy

The token tables above own *values*. This section owns *when to reach for which token* — guidance that doesn't fit a table.

### Brand vs primary

Two tokens, distinct roles — don't conflate.

- **`--primary`** (blue `#007eff`) is the workhorse action color: primary buttons, active nav, focus rings (`ring-primary/30`), informational/neutral links. `--ring` mirrors `--primary`.
- **`--brand`** (green `#43BE64`) is a brand-moment accent: logo flourish, marketing-flavored emphasis. **Not** for primary actions, decoration, or hover tints.

Positive metrics and success states use `--positive` (the soft-green badge pair), **not** `--brand`. Neutral hover stays `bg-accent/40` (existing pill pattern).

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

### When in doubt

1. Look at Notion or Slack first.
2. Check the prototype for an analogous pattern.
3. More whitespace over less.
4. Fewer font sizes over more.
5. Border over shadow.

## Figma → token mapping

The Simplesat Figma design system has ~500 tokens. The above mirror the **Site Colors / Brand Colors / Page / Text / Border / Emotive** sections only. **Intentionally not adopted:**

- All 13 hue families (`red`, `orange`, `yellow`, `olive`, `teal`, `violet`, `purple`, `pink`, `brown`, `light*`). Out of scope for a CSAT prototype — primary + status covers our needs. Add per use case if a feature demands a hue.
- `Hover-color/*`, `Down-color/*`, `Active-color/*`, `Focus-color/*` per-hue variants. Tailwind's `/N` opacity utilities cover most state shading; the explicit `primary-hover` / `primary-down` cover the one color that needed brand-true states.
- `FullBlack/*` and `Black/*` 5%–95% opacity ladders. Use `text-foreground/40` style instead.

If you find yourself wanting a token that's in Figma but not here, prefer **adding it here** to hardcoding it in a component.

## Pending migrations

- **`bg-canvas` for the body.** `--canvas: #f4f4f4` exists but the body still uses `bg-background` (white). To switch to the layered "grey canvas + white cards" look: (1) change body to `bg-canvas` in [`src/app/layout.tsx`](src/app/layout.tsx), (2) audit the two existing `bg-background` panels (`src/app/(workspace)/page.tsx` dashboard section and `src/components/shell/topbar.tsx`) — they should become `bg-card` so they read as elevated against the canvas. Holding off until we've decided we want that look.

## How to change a color

1. Edit the value in `:root` (and the matching `.dark` value if applicable) inside `src/app/globals.css`.
2. Reload. Done.

If a component is hardcoding a hex, that's a bug — fix it by routing the value through a token.

## How to add a new token

1. `:root { --my-token: <value>; }` in `globals.css` (and `.dark { --my-token: <value>; }` if it differs in dark mode).
2. `@theme inline { --color-my-token: var(--my-token); }` in the `@theme inline` block immediately above.
3. Use `bg-my-token` / `text-my-token` / `border-my-token` in components.

No Tailwind config, no theme provider, no codegen — Tailwind v4 reads the `@theme` block at build time.

## See also

- [`CLAUDE.md`](CLAUDE.md) → **Conventions** → "Font sizes" / "Value font color rule" — per-element type and color rules
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — where the tokens get consumed (Property registry, EntityTable, Drawer, etc.)
- [`src/app/globals.css`](src/app/globals.css) — the actual var declarations
- [`src/app/layout.tsx`](src/app/layout.tsx) — `next/font/google` font loader
