export const dynamic = "force-dynamic";

import { AlertCircle, ArrowLeft, ArrowRight, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/shell/topbar";
import {
  CustomerPill,
  TeamMemberPill,
  TicketPill,
  ResponsePill,
  SurveyPill,
  CompanyPill,
} from "@/components/shared/entity-pill";
import { TierPill } from "@/components/shared/tier-pill";
import { TeamPill } from "@/components/shared/team-pill";
import { TeamGroupPill } from "@/components/shared/team-group-pill";
import { StatusPill } from "@/components/tickets/status-pill";
import { PriorityPill } from "@/components/tickets/priority-pill";
import { ChannelPill } from "@/components/tickets/channel-pill";
import { Avatar } from "@/components/shared/avatar";
import { dicebearUrl } from "@/lib/color-from-name";
import { StarRating } from "@/components/shared/star-rating";
import { AvgRating } from "@/components/shared/avg-rating";
import { StatCard } from "@/components/shared/stat-card";
import { Tag } from "@/components/shared/tag";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { listCustomers } from "@/db/queries/customers";
import { listTeamMembers } from "@/db/queries/team-members";
import { listTickets } from "@/db/queries/tickets";
import { listResponses } from "@/db/queries/responses";
import { listSurveys } from "@/db/queries/surveys";

// ----------------------------------------------------------------------------
// Audit data — frozen at 2026-05-21. Re-run `grep -rohE ... | sort | uniq -c`
// to refresh; this page intentionally surfaces stale counts as their own drift.
// ----------------------------------------------------------------------------

type Drift = { kind: "doc-exception" | "drift" | "unused"; reason: string };

const TYPOGRAPHY_ROWS: Array<{
  cls: string;
  computed: string;
  intent: string;
  uses: number;
  sample: string;
  drift?: Drift;
}> = [
  {
    cls: "text-3xl",
    computed: "30 / 36",
    intent: "Entity name in detail header",
    uses: 5,
    sample: "Charlotte Reyes",
  },
  {
    cls: "text-2xl",
    computed: "24 / 32",
    intent: "(undocumented)",
    uses: 4,
    sample: "Dashboard heading",
    drift: {
      kind: "drift",
      reason:
        "no entry in CLAUDE.md → Font sizes; used for workspace H1, dashboard metric, StatCard value, coming-soon H1",
    },
  },
  {
    cls: "text-xl",
    computed: "20 / 28",
    intent: "(none)",
    uses: 0,
    sample: "Not in use",
    drift: { kind: "unused", reason: "no occurrences in src/" },
  },
  {
    cls: "text-lg",
    computed: "18 / 28",
    intent: "(undocumented)",
    uses: 1,
    sample: "Popover tabular value",
    drift: {
      kind: "drift",
      reason:
        "no entry in CLAUDE.md → Font sizes; one use in entity-popover.tsx",
    },
  },
  {
    cls: "text-base",
    computed: "16 / 24",
    intent: "Feed card / chat bubble body",
    uses: 16,
    sample: "Centerpiece content reads here.",
  },
  {
    cls: "text-sm",
    computed: "15 / 22  (overridden from Tailwind default 14 / 20)",
    intent: "Body, nav, table cells, property labels",
    uses: 123,
    sample: "Body, nav, table cells, property labels.",
  },
  {
    cls: "text-xs",
    computed: "12 / 16",
    intent: "Stateful pills (status, channel, tier) + kbd ONLY",
    uses: 61,
    sample: "Stateful pill / kbd content.",
    drift: {
      kind: "drift",
      reason:
        "~30 of 61 occurrences are outside the allowed list — see breakdown below",
    },
  },
];

const ARBITRARY_SIZES: Array<{
  spec: string;
  uses: number;
  where: string;
}> = [
  {
    spec: "text-[14px]",
    uses: 34,
    where:
      "Tailwind-default-14px hardcoded in spots that pre-dated the 15px text-sm override",
  },
  {
    spec: "text-[10px]",
    uses: 14,
    where:
      "avatar sm size · kbd · entity-popover section headers · columns-control category labels · DEMO badges · SurveyPill metric tag",
  },
  {
    spec: "text-[11px]",
    uses: 7,
    where:
      "avatar md size · response-answers multi-select chip · pill arrow icon sizes",
  },
  {
    spec: "text-[13px]",
    uses: 1,
    where: "single one-off",
  },
  {
    spec: "text-[12px]",
    uses: 1,
    where: "single one-off",
  },
  {
    spec: "text-[0.8rem]",
    uses: 1,
    where: "Button size=\"sm\" (12.8px — bypasses both text-xs (12) and text-sm (15))",
  },
];

const TEXT_XS_VIOLATIONS: Array<{ file: string; note: string }> = [
  {
    file: "components/reports/pivot-table.tsx",
    note: "8 occurrences — column headers + totals row + sticky left column. Inconsistent with EntityTable headers (text-sm).",
  },
  {
    file: "components/shared/stat-card.tsx:12",
    note: "label uses text-xs uppercase tracking-wide — triple violation (text-xs for label + forced uppercase + tracking)",
  },
  {
    file: "components/shared/columns-control.tsx:49",
    note: 'text-[10px] font-medium uppercase tracking-wide — even smaller, still uppercase',
  },
  {
    file: "components/shared/layout-toggle.tsx:33",
    note: "toggle buttons use text-xs",
  },
  {
    file: "components/shell/search-palette.tsx",
    note: "group heading, ellipses, file path footer (3 spots)",
  },
  {
    file: "components/shared/filter-row.tsx:566",
    note: "filter group label (text-xs font-medium)",
  },
  {
    file: "components/reports/axis-zone.tsx:100",
    note: "drop-zone group label (text-xs font-medium)",
  },
  {
    file: "components/reports/property-rail.tsx:42",
    note: "rail group label (text-xs font-medium)",
  },
  {
    file: "components/reports/ai-prompt-dialog.tsx",
    note: "example chips and 'Try one of' label (2 spots)",
  },
  {
    file: "components/shared/entity-popover.tsx",
    note: "popover body subtitles + footer rows (6 spots)",
  },
  {
    file: "components/shared/tag.tsx:3",
    note: "Tag is entirely text-xs (used for non-stateful tag content)",
  },
  {
    file: "components/ui/dropdown-menu.tsx:173",
    note: "group label",
  },
  {
    file: "app/(workspace)/page.tsx",
    note: "'what's new' subtitles and links (5 spots)",
  },
  {
    file: "components/surveys/survey-detail.tsx:88",
    note: "meta line",
  },
  {
    file: "components/responses/response-detail.tsx:65",
    note: "meta line",
  },
  {
    file: "lib/properties/{customers,team-members,tickets,responses,surveys,response-answers}.tsx",
    note: "font-mono text-xs ID cells in 6 registries — formally a violation; endorsed by ARCHITECTURE.md → Property registry → 'detail override pattern' as a documented exception",
  },
];

const COLOR_GROUPS: Array<{
  title: string;
  tokens: Array<{
    token: string;
    use: string;
    drift?: Drift;
  }>;
}> = [
  {
    title: "Surfaces",
    tokens: [
      { token: "background", use: "Body canvas" },
      { token: "card", use: "Elevated surfaces — cards, drawer body" },
      { token: "popover", use: "Radix portals (HoverCard, Dropdown)" },
      { token: "muted", use: "Subtle fill — kbd, dashed panels" },
      { token: "secondary", use: "Secondary buttons" },
      { token: "accent", use: "Pill hover tint (bg-accent/40)" },
      {
        token: "canvas",
        use: "Page-canvas grey",
        drift: {
          kind: "unused",
          reason:
            "declared but body still uses bg-background; pending migration in DESIGN.md",
        },
      },
    ],
  },
  {
    title: "Text",
    tokens: [
      { token: "foreground", use: 'Simplesat "Black" — primary text' },
      { token: "muted-foreground", use: "Secondary metadata (emails, IDs, dates)" },
      {
        token: "foreground-light",
        use: "Tertiary text / hints",
        drift: { kind: "unused", reason: "declared, 0 utility uses in src/" },
      },
      {
        token: "foreground-disabled",
        use: "Disabled controls",
        drift: { kind: "unused", reason: "declared, 0 utility uses in src/" },
      },
    ],
  },
  {
    title: "Brand & primary",
    tokens: [
      { token: "primary", use: "Primary actions, focus rings, active nav" },
      { token: "primary-foreground", use: "Text on primary" },
      {
        token: "primary-hover",
        use: "Primary button hover",
      },
      {
        token: "primary-down",
        use: "Primary button pressed",
        drift: { kind: "unused", reason: "declared, 0 utility uses in src/" },
      },
      {
        token: "brand",
        use: "Brand-moment accent (logo flourish)",
        drift: { kind: "unused", reason: "declared, 0 utility uses in src/" },
      },
      {
        token: "brand-foreground",
        use: "Text on brand",
        drift: { kind: "unused", reason: "declared, 0 utility uses in src/" },
      },
    ],
  },
  {
    title: "Status (semantic — meant for stateful pills)",
    tokens: [
      { token: "positive", use: "Positive bg — used in StatCard tones" },
      { token: "positive-foreground", use: "Positive fg" },
      {
        token: "negative",
        use: "Negative bg",
        drift: {
          kind: "drift",
          reason:
            "only 1 bg-negative + 2 text-negative uses; all stateful pills hardcode bg-red-50 instead",
        },
      },
      {
        token: "negative-foreground",
        use: "Negative fg",
      },
      {
        token: "neutral",
        use: "Neutral / warning bg",
        drift: {
          kind: "unused",
          reason:
            "declared, 0 utility uses — status / priority / tier pills all hardcode bg-amber-50 instead",
        },
      },
      {
        token: "neutral-foreground",
        use: "Neutral / warning fg",
        drift: { kind: "unused", reason: "declared, 0 utility uses in src/" },
      },
      {
        token: "info",
        use: "Info bg",
        drift: {
          kind: "unused",
          reason:
            "declared, 0 utility uses — channel / team pills hardcode bg-blue-50 instead",
        },
      },
      {
        token: "info-foreground",
        use: "Info fg",
        drift: { kind: "unused", reason: "declared, 0 utility uses in src/" },
      },
    ],
  },
  {
    title: "Borders & focus",
    tokens: [
      { token: "border", use: "Default subtle border (10% black)" },
      { token: "border-strong", use: "Emphasis border (20% black)" },
      {
        token: "border-solid",
        use: "Opaque divider for non-white surfaces",
      },
      { token: "input", use: "Form input border" },
      { token: "ring", use: "Focus ring (mirrors --primary)" },
    ],
  },
  {
    title: "Selection",
    tokens: [
      { token: "selection", use: "Selected row / text-highlight bg" },
      { token: "selection-foreground", use: "Text over --selection" },
    ],
  },
  {
    title: "Nav section icons",
    tokens: [
      { token: "icon-responses", use: "Responses (matches --primary)" },
      { token: "icon-customers", use: "Customers" },
      { token: "icon-team-members", use: "Team members" },
      { token: "icon-tickets", use: "Tickets" },
      { token: "icon-reports", use: "Reports" },
    ],
  },
  {
    title: "Charts (Recharts)",
    tokens: [
      {
        token: "chart-1",
        use: "Series 1",
        drift: {
          kind: "drift",
          reason:
            "DESIGN.md claims 6 named hex hues (blue/green/yellow/red/purple/grey); globals.css declares chart-1..5 as all-greyscale oklch. Docs and code disagree.",
        },
      },
      { token: "chart-2", use: "Series 2" },
      { token: "chart-3", use: "Series 3" },
      { token: "chart-4", use: "Series 4" },
      { token: "chart-5", use: "Series 5" },
    ],
  },
  {
    title: "Destructive",
    tokens: [
      {
        token: "destructive",
        use: "Destructive button + danger ring",
        drift: {
          kind: "drift",
          reason:
            "used 40× across src/ (text/bg/border/ring-destructive) but absent from every DESIGN.md token table",
        },
      },
    ],
  },
  {
    title: "Sidebar (shadcn defaults)",
    tokens: [
      { token: "sidebar", use: "Sidebar bg" },
      { token: "sidebar-foreground", use: "Sidebar text" },
      { token: "sidebar-primary", use: "Sidebar primary" },
      { token: "sidebar-primary-foreground", use: "Sidebar primary text" },
      { token: "sidebar-accent", use: "Sidebar accent" },
      { token: "sidebar-accent-foreground", use: "Sidebar accent text" },
      { token: "sidebar-border", use: "Sidebar border" },
      { token: "sidebar-ring", use: "Sidebar focus ring" },
    ],
  },
];

const COLOR_FOOTER_DRIFT: string[] = [
  "Tokens declared but zero utility uses: --brand, --brand-foreground, --primary-down, --foreground-light, --foreground-disabled, --neutral, --neutral-foreground, --info, --info-foreground.",
  "Tokens used in src/ but undocumented in DESIGN.md tables: --destructive (40+ uses) and the --sidebar-* family (consumed by shadcn primitives).",
  "Chart palette: DESIGN.md lists six named hex colors; globals.css defines --chart-1..5 as all-greyscale oklch — pick one source of truth.",
  "All stateful pills (status / priority / channel / tier / team / team-group / survey status) hardcode raw Tailwind hues (bg-red-50, bg-amber-50, …) instead of the --positive / --negative / --neutral / --info tokens. That's why the status tokens read as zero-use — the demand is real, the wiring isn't.",
  "Avatar background palette (16 hex colors in src/lib/color-from-name.ts and 13 in src/db/seed.ts) lives outside the token system entirely. No DESIGN.md entry for a decorative-rainbow scale.",
];

const RADIUS_STEPS: Array<{ cls: string; multiplier: string; px: string }> = [
  { cls: "rounded-sm", multiplier: "× 0.6", px: "6px" },
  { cls: "rounded-md", multiplier: "× 0.8", px: "8px" },
  { cls: "rounded-lg", multiplier: "× 1.0", px: "10px" },
  { cls: "rounded-xl", multiplier: "× 1.4", px: "14px" },
  { cls: "rounded-2xl", multiplier: "× 1.8", px: "18px" },
  { cls: "rounded-3xl", multiplier: "× 2.2", px: "22px" },
  { cls: "rounded-4xl", multiplier: "× 2.6", px: "26px" },
];

const SHADOW_STEPS: Array<{
  cls: string;
  use: string;
  drift?: Drift;
}> = [
  {
    cls: "shadow-none",
    use: "Default — borders-first product",
  },
  {
    cls: "shadow-sm",
    use: "Active tab state",
    drift: {
      kind: "drift",
      reason:
        "DESIGN.md → Shadows: portals only. ui/tabs uses shadow-sm on its inline active state.",
    },
  },
  { cls: "shadow-md", use: "Radix HoverCard / Popover / Dropdown / Select" },
  { cls: "shadow-lg", use: "Radix Sheet / report-builder drag overlay" },
  {
    cls: "shadow-2xl",
    use: "detail-drawer.tsx",
    drift: {
      kind: "drift",
      reason:
        "DESIGN.md → Shadows: portals only. The drawer is not a Radix portal — it's an inline panel and shouldn't carry a shadow per the doc.",
    },
  },
];

const SPACING_ALLOWED = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];

const SPACING_USED_OUTSIDE: Array<{
  utility: string;
  px: number;
  uses: number;
  note: string;
}> = [
  {
    utility: "*-0.5",
    px: 2,
    uses: 34,
    note:
      "almost all stateful pills (py-0.5) — the pill convention has diverged from the documented scale without being documented",
  },
  {
    utility: "*-1.5",
    px: 6,
    uses: 80,
    note:
      "very common (px-1.5, py-1.5, gap-1.5) — used in dropdowns, pill icon gaps, pivot table cells, popover dividers",
  },
  {
    utility: "*-2.5",
    px: 10,
    uses: 9,
    note: "used in shadcn dropdown content padding and a few labels",
  },
  {
    utility: "*-3.5",
    px: 14,
    uses: 0,
    note: "not in use — kept here for completeness",
  },
];

const PILL_INTERACTIVE_NOTES: string[] = [
  "Interactive entity pills (Customer, TeamMember, Ticket, Response w/ id, Survey) share a strict shape: rounded -mx-1 px-1 py-0.5, bg-accent/40, hover bg-accent, always-visible ArrowUpRight, popover on hover, drawer on click.",
  "CompanyPill (right, plain text) intentionally breaks the shape per CLAUDE.md — organization is a string, not yet an entity. The visual gap is doing real work: the lack of an arrow says 'don't click me'.",
  "ResponsePill swaps between the interactive shape (with id) and a plain span (without id) — same component name, two visual modes. Worth flagging because the rendering happens at the property registry level and is easy to miss.",
];

const STATEFUL_PILL_DRIFT: string[] = [
  "Every pill below hardcodes raw Tailwind hues (bg-red-50, bg-emerald-50, bg-amber-50, bg-blue-50, bg-violet-50, bg-orange-50, bg-pink-50, bg-purple-50, bg-cyan-50) plus dark variants.",
  "Semantic tokens that exist for exactly this purpose (--positive, --negative, --neutral, --info) are unused.",
  "The 'right' fix is one of: (a) wire status/priority/tier through the four semantic tokens; (b) add a decorative-hue token scale to DESIGN.md (red/amber/emerald/blue/violet/orange/pink/purple/cyan, light + dark) and route everything through it. Today the doc commits to (a) but the code does neither.",
];

const BUTTON_VARIANTS_IN_USE: Array<{
  variant: "default" | "outline" | "ghost";
  uses: string;
}> = [
  { variant: "default", uses: "default (no explicit variant)" },
  { variant: "outline", uses: "2 explicit uses" },
  { variant: "ghost", uses: "8 explicit uses" },
];

const BUTTON_SIZES_IN_USE: Array<{
  size: "default" | "sm" | "lg";
  note: string;
}> = [
  { size: "default", note: "default" },
  {
    size: "sm",
    note:
      "12 explicit uses — text-[0.8rem] (12.8px), bypasses both text-xs (12) and text-sm (15)",
  },
  { size: "lg", note: "4 explicit uses" },
];

const AVATAR_SIZES: Array<{
  size: "sm" | "md" | "lg" | "xl";
  px: string;
  text: string;
  drift?: Drift;
}> = [
  {
    size: "sm",
    px: "20px",
    text: "text-[10px]",
    drift: {
      kind: "drift",
      reason:
        "arbitrary text-[10px] inside a primitive — bypasses the documented type scale",
    },
  },
  {
    size: "md",
    px: "24px",
    text: "text-[11px]",
    drift: {
      kind: "drift",
      reason: "arbitrary text-[11px] — bypasses the documented type scale",
    },
  },
  { size: "lg", px: "36px", text: "text-sm" },
  { size: "xl", px: "40px", text: "text-base" },
];

const UNDOCUMENTED_BUT_USED: string[] = [
  "StarRating — not mentioned in DESIGN.md; uses hardcoded fill-amber-400 / fill-zinc-200 (raw Tailwind, not tokens).",
  "AvgRating — not mentioned in DESIGN.md; tone colors hardcoded text-red-600 / text-amber-600 / text-emerald-600 in a shared helper exported as ratingTone().",
  "StatCard — not mentioned in DESIGN.md; label is the triple-violation pattern (text-xs uppercase tracking-wide).",
  'Tag — text-xs by definition; used 1× in code. If kept, define what "Tag" is for vs. all the other pills.',
  '"DEMO" purple badges in workspace home and ticket detail — hand-rolled spans with text-[10px] uppercase tracking-wider rather than the existing Badge primitive from ui/badge.tsx. Same shape twice.',
  "Lato font — loaded via next/font/google in layout.tsx, flows into --font-sans. Documented in DESIGN.md → Typography but not in a token table.",
];

// ----------------------------------------------------------------------------
// Inline helpers — page-local Server Components, intentionally not promoted
// into shared/. The audit page should not introduce reusable design surface.
// ----------------------------------------------------------------------------

function DriftMark({ drift }: { drift: Drift }) {
  const tone =
    drift.kind === "drift"
      ? "bg-red-lighter text-red-darker"
      : drift.kind === "doc-exception"
        ? "bg-blue-lighter text-blue-darker"
        : "bg-muted text-muted-foreground";
  const label =
    drift.kind === "drift"
      ? "drift"
      : drift.kind === "doc-exception"
        ? "doc exception"
        : "unused";
  return (
    <span
      className={`inline-flex items-start gap-1.5 rounded px-2 py-0.5 text-xs ${tone}`}
    >
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-current opacity-80" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="font-normal opacity-90"> — {drift.reason}</span>
      </span>
    </span>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-16 first:mt-0">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          {intro}
        </p>
      </header>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Subsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-12 first:mt-0">
      <div className="flex items-baseline gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && (
          <span className="text-sm text-muted-foreground">{description}</span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DriftFooter({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-border-strong bg-muted/40 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <AlertCircle size={16} className="text-muted-foreground" />
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-sm text-foreground/90">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders children twice — once in light mode, once with a `.dark` class
 * wrapper that flips every CSS variable in globals.css. Both render
 * simultaneously so drift between modes is visible without toggling.
 *
 * The page itself stays in the user's actual mode; only these demo plates
 * force their own mode.
 */
function BothModes({
  children,
  variant = "card",
}: {
  children: React.ReactNode;
  variant?: "card" | "bare";
}) {
  const innerCls =
    variant === "card"
      ? "rounded-lg border border-border bg-background p-5"
      : "";
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className={innerCls}>
        <div className="mb-3 text-sm font-medium text-muted-foreground">
          Light
        </div>
        {children}
      </div>
      <div className={`dark ${innerCls}`}>
        <div className="mb-3 text-sm font-medium text-muted-foreground">
          Dark
        </div>
        {children}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------

export default async function DesignAuditPage() {
  // Seed one of each entity so the live pills below have real ids to link to.
  // Each call is cheap (sqlite, first row).
  const [customers, teamMembers, tickets, responses, surveys] =
    await Promise.all([
      listCustomers({}),
      listTeamMembers({}),
      listTickets({
        page: 1,
        pageSize: 1,
        sorts: [],
      }),
      listResponses({ limit: 1 }),
      listSurveys(),
    ]);

  const sampleCustomer = customers.rows[0];
  const sampleTeamMember = teamMembers.rows[0];
  const sampleTicket = tickets.rows[0];
  const sampleResponse = responses.rows[0];
  const sampleSurvey = surveys[0];

  return (
    <div className="flex-1 min-w-0">
      <Topbar
        crumbs={[
          { label: "Design audit", href: "/design" },
          { label: "Snapshot — 2026-05-21" },
        ]}
      />

      <main className="mx-auto max-w-6xl px-10 py-10 xl:px-14">
        <div className="mb-8 rounded-lg border border-dashed border-border-strong bg-muted/40 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-foreground">
                Historical snapshot — pre-sweep state of 2026-05-21
              </div>
              <p className="mt-2 text-base text-muted-foreground">
                Frozen audit produced the day before PR #17&apos;s mechanical
                sweep landed. Captures the codebase in its pre-cleanup state —
                raw Tailwind hues in pills, arbitrary text sizes scattered
                across components, deprecated state-semantic tokens (
                <span className="font-mono">--positive</span>,{" "}
                <span className="font-mono">--negative</span>,{" "}
                <span className="font-mono">--neutral</span>,{" "}
                <span className="font-mono">--info</span>,{" "}
                <span className="font-mono">--brand</span>) still declared in{" "}
                <span className="font-mono">globals.css</span>.
              </p>
              <p className="mt-2 text-base text-muted-foreground">
                Kept as a historical record so the audit can show its own
                effect: every drift item flagged here was either resolved in
                the sweep or remains on the current audit with a refreshed
                count. Some color tokens shown below (
                <span className="font-mono">--positive</span>,{" "}
                <span className="font-mono">--info</span>, etc.) no longer
                exist in <span className="font-mono">globals.css</span>, so
                their swatches render as transparent / inherited — that
                rendering gap is itself the historical record.
              </p>
              <Link
                href="/design"
                className="mt-3 inline-flex items-center gap-1.5 text-base text-primary hover:underline underline-offset-4"
              >
                <ArrowLeft size={14} />
                Back to current audit (2026-05-22)
              </Link>
            </div>
          </div>
        </div>

        <header className="border-b border-border pb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Design audit — 2026-05-21 (pre-sweep)
          </h1>
          <p className="mt-3 max-w-prose text-base text-muted-foreground">
            A single-page audit of where this prototype&apos;s tokens, type scale,
            and components have drifted from the rules in CLAUDE.md and
            DESIGN.md. This is not a component gallery — every section puts
            real, live components next to the documented rule so drift is
            visible at a glance.
          </p>
          <p className="mt-3 max-w-prose text-base text-muted-foreground">
            Counts frozen 2026-05-21 (pre-sweep). Most drift items in this audit
            were resolved in the mechanical sweep that immediately followed —
            see <span className="font-mono">DESIGN.md</span> →{" "}
            &ldquo;Landed in the mechanical sweep&rdquo; for the changelog.
            Colors read live from{" "}
            <span className="font-mono">var(--token)</span> in{" "}
            <span className="font-mono">globals.css</span> — swatches stay in
            sync with the token source.
          </p>
          <nav className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <a
              href="#typography"
              className="text-primary hover:underline underline-offset-4"
            >
              § 1 Typography
            </a>
            <a
              href="#tokens"
              className="text-primary hover:underline underline-offset-4"
            >
              § 2 Tokens
            </a>
            <a
              href="#components"
              className="text-primary hover:underline underline-offset-4"
            >
              § 3 Components
            </a>
            <span className="ml-auto inline-flex items-center gap-2 text-muted-foreground">
              <span className="inline-flex size-2 rounded-full bg-red" />
              drift
              <span className="ml-3 inline-flex size-2 rounded-full bg-blue" />
              doc exception
              <span className="ml-3 inline-flex size-2 rounded-full bg-muted-foreground/60" />
              unused
            </span>
          </nav>
        </header>

        {/* ─────────────────────────  § 1 TYPOGRAPHY  ───────────────────────── */}
        <Section
          id="typography"
          title="1. Typography"
          intro="Every text-* class actually present in src/, at its real size, with the documented intended use and the count of occurrences. Sizes used outside CLAUDE.md → Font sizes are flagged drift."
        >
          <Subsection title="Type ladder">
            <div className="divide-y divide-border rounded-lg border border-border">
              {TYPOGRAPHY_ROWS.map((row) => (
                <div
                  key={row.cls}
                  className="grid grid-cols-[150px_110px_1fr_60px] items-center gap-4 px-5 py-4"
                >
                  <div>
                    <div className="font-mono text-sm">{row.cls}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {row.computed}px
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {row.intent}
                  </div>
                  <div className={`${row.cls} truncate text-foreground`}>
                    {row.sample}
                  </div>
                  <div className="text-right tabular-nums text-sm text-muted-foreground">
                    {row.uses} use{row.uses === 1 ? "" : "s"}
                  </div>
                  {row.drift && (
                    <div className="col-span-4">
                      <DriftMark drift={row.drift} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Subsection>

          <Subsection
            title="text-xs violations"
            description="Allowed only for stateful pills (status / channel / tier) and kbd."
          >
            <div className="rounded-lg border border-border">
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm hover:bg-muted/40">
                  <span>
                    <span className="font-medium">
                      {TEXT_XS_VIOLATIONS.length} location
                      {TEXT_XS_VIOLATIONS.length === 1 ? "" : "s"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      where text-xs is used outside the allowed list
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground group-open:hidden">
                    expand
                  </span>
                  <span className="text-sm text-muted-foreground hidden group-open:inline">
                    collapse
                  </span>
                </summary>
                <ul className="divide-y divide-border border-t border-border">
                  {TEXT_XS_VIOLATIONS.map((v) => (
                    <li key={v.file} className="px-5 py-3 text-sm">
                      <div className="font-mono text-foreground">{v.file}</div>
                      <div className="mt-1 text-muted-foreground">{v.note}</div>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </Subsection>

          <Subsection
            title="Arbitrary one-off sizes"
            description="Every text-[…px] occurrence in src/. Each bypasses the documented scale."
          >
            <div className="divide-y divide-border rounded-lg border border-border">
              {ARBITRARY_SIZES.map((row) => (
                <div
                  key={row.spec}
                  className="grid grid-cols-[160px_60px_1fr] items-start gap-4 px-5 py-3"
                >
                  <div className="font-mono text-sm">{row.spec}</div>
                  <div className="text-right tabular-nums text-sm text-muted-foreground">
                    {row.uses} use{row.uses === 1 ? "" : "s"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {row.where}
                  </div>
                </div>
              ))}
            </div>
          </Subsection>

          <DriftFooter
            title="Typography — used but undocumented"
            items={[
              "text-2xl: used 4× (workspace H1, dashboard metric, StatCard value, coming-soon H1) but absent from CLAUDE.md → Font sizes. Either document it as the H1 size, or move H1s to text-3xl.",
              "text-lg: 1 use in entity-popover.tsx for a tabular value. Either delete or document.",
              "text-xl: 0 uses. Not necessarily drift — but if H1 is text-2xl and entity-name is text-3xl, nothing in the doc explains the missing rung.",
              "Six different arbitrary text-[…] sizes (60+ occurrences total) live entirely outside the scale. Pick the closest scale step or document a new rung.",
            ]}
          />
        </Section>

        {/* ─────────────────────────  § 2 TOKENS  ───────────────────────── */}
        <Section
          id="tokens"
          title="2. Tokens"
          intro="Every CSS variable declared in globals.css, read live, in both light and dark mode side-by-side. Bottom of each panel lists tokens that are documented but unused, or used but undocumented."
        >
          {/* ── Colors ── */}
          <Subsection
            title="Colors"
            description="Swatches read live from var(--token). Light and dark render simultaneously."
          >
            <div className="space-y-6">
              {COLOR_GROUPS.map((group) => (
                <div key={group.title}>
                  <h4 className="text-sm font-semibold text-foreground">
                    {group.title}
                  </h4>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(["light", "dark"] as const).map((mode) => (
                      <div
                        key={mode}
                        className={`${mode === "dark" ? "dark " : ""}rounded-lg border border-border bg-background p-4`}
                      >
                        <div className="mb-3 text-xs font-medium text-muted-foreground">
                          {mode === "dark" ? "Dark" : "Light"}
                        </div>
                        <ul className="space-y-3">
                          {group.tokens.map((t) => (
                            <li
                              key={t.token}
                              className="flex items-start gap-3"
                            >
                              <div
                                aria-hidden
                                className="size-10 shrink-0 rounded-md border border-border-strong"
                                style={{ background: `var(--${t.token})` }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-mono text-sm text-foreground">
                                  --{t.token}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {t.use}
                                </div>
                                {t.drift && (
                                  <div className="mt-2">
                                    <DriftMark drift={t.drift} />
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <DriftFooter
              title="Color tokens — used but undocumented / documented but unused"
              items={COLOR_FOOTER_DRIFT}
            />
          </Subsection>

          {/* ── Borders & radius ── */}
          <Subsection
            title="Borders, radius, shadows"
            description="Border and focus colors swatch above; radius and shadow scales below."
          >
            <BothModes>
              <div className="space-y-3">
                <div
                  className="rounded-md border-2 p-3 text-sm"
                  style={{ borderColor: "var(--border)" }}
                >
                  border-2 with <span className="font-mono">--border</span>
                </div>
                <div
                  className="rounded-md border-2 p-3 text-sm"
                  style={{ borderColor: "var(--border-strong)" }}
                >
                  border-2 with{" "}
                  <span className="font-mono">--border-strong</span>
                </div>
                <div
                  className="rounded-md border-2 p-3 text-sm"
                  style={{ borderColor: "var(--border-solid)" }}
                >
                  border-2 with{" "}
                  <span className="font-mono">--border-solid</span>
                </div>
                <div
                  className="rounded-md border-2 p-3 text-sm"
                  style={{ borderColor: "var(--input)" }}
                >
                  border-2 with <span className="font-mono">--input</span>
                </div>
                <div
                  className="rounded-md border-2 p-3 text-sm"
                  style={{ borderColor: "var(--ring)" }}
                >
                  border-2 with <span className="font-mono">--ring</span>
                </div>
              </div>
            </BothModes>

            <div className="mt-8">
              <h4 className="text-sm font-semibold">Radius scale</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Derived from <span className="font-mono">--radius: 0.625rem</span>{" "}
                (10px) via multipliers in <span className="font-mono">@theme inline</span>.
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                {RADIUS_STEPS.map((r) => (
                  <div key={r.cls} className="flex flex-col items-center gap-2">
                    <div
                      className={`size-16 border border-border-strong bg-muted ${r.cls}`}
                    />
                    <div className="text-center">
                      <div className="font-mono text-sm">{r.cls}</div>
                      <div className="text-sm text-muted-foreground">
                        {r.multiplier} = {r.px}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <h4 className="text-sm font-semibold">Shadow scale (as used)</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                DESIGN.md → Shadows: borders-first product, shadows only on
                Radix portals. Inline-card shadows are drift.
              </p>
              <div className="mt-4 flex flex-wrap gap-6">
                {SHADOW_STEPS.map((s) => (
                  <div
                    key={s.cls}
                    className="flex flex-col items-start gap-2"
                  >
                    <div
                      className={`size-20 rounded-lg border border-border bg-card ${s.cls}`}
                    />
                    <div>
                      <div className="font-mono text-sm">{s.cls}</div>
                      <div className="text-sm text-muted-foreground">
                        {s.use}
                      </div>
                      {s.drift && (
                        <div className="mt-2">
                          <DriftMark drift={s.drift} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Subsection>

          {/* ── Spacing ── */}
          <Subsection
            title="Spacing"
            description="DESIGN.md → Spacing rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. No 6, no 10, no 14."
          >
            <div className="rounded-lg border border-border p-5">
              <div className="space-y-2">
                {SPACING_ALLOWED.map((px) => (
                  <div
                    key={px}
                    className="flex items-center gap-4"
                  >
                    <div className="w-12 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {px}px
                    </div>
                    <div
                      className="h-3 rounded-sm bg-primary/70"
                      style={{ width: `${px}px` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-border">
              <div className="border-b border-border px-5 py-3 text-sm font-semibold">
                Off-scale utilities used in src/
              </div>
              <div className="divide-y divide-border">
                {SPACING_USED_OUTSIDE.map((row) => (
                  <div
                    key={row.utility}
                    className="grid grid-cols-[120px_70px_70px_1fr] items-center gap-4 px-5 py-3 text-sm"
                  >
                    <div className="font-mono">{row.utility}</div>
                    <div className="tabular-nums">{row.px}px</div>
                    <div className="text-right tabular-nums text-muted-foreground">
                      {row.uses}
                    </div>
                    <div className="text-muted-foreground">{row.note}</div>
                  </div>
                ))}
              </div>
            </div>

            <DriftFooter
              title="Spacing — what diverged"
              items={[
                "Every stateful pill in src/ uses py-0.5 (2px). That's not on the documented scale — either add 2 as an allowed micro-step for pills or rework the pill height to land on 4/8/12.",
                "*-1.5 (6px) is the second most-common gap utility in the codebase. Either add 6 to the scale or rework downward.",
                "DESIGN.md → Defaults lists page padding 24 / 32, card padding 20, drawer 24, detail px-14 py-10 — every one of those is on-scale and consistent. The drift is entirely in micro-gaps, not in page rhythm.",
              ]}
            />
          </Subsection>
        </Section>

        {/* ─────────────────────────  § 3 COMPONENTS  ───────────────────── */}
        <Section
          id="components"
          title="3. Component inventory"
          intro="Every component variant the codebase actually uses, rendered side-by-side at the same scale so visual drift jumps out. Logical duplicates (same idea, two renderings) are placed adjacent."
        >
          {/* ── Entity pills ── */}
          <Subsection
            title="Entity pills"
            description="Linked, popover-on-hover, drawer-on-click. Live components with real seed ids."
          >
            <BothModes>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                {sampleCustomer && (
                  <CustomerPill
                    id={sampleCustomer.id}
                    name={sampleCustomer.name}
                  />
                )}
                {sampleTeamMember && (
                  <TeamMemberPill
                    id={sampleTeamMember.id}
                    name={sampleTeamMember.name}
                    avatarColor={sampleTeamMember.avatarColor}
                  />
                )}
                {sampleTicket && (
                  <TicketPill
                    id={sampleTicket.id}
                    externalId={sampleTicket.externalId}
                    subject={sampleTicket.subject}
                  />
                )}
                {sampleTicket && (
                  <TicketPill
                    id={sampleTicket.id}
                    externalId={sampleTicket.externalId}
                  />
                )}
                {sampleResponse && (
                  <ResponsePill
                    id={sampleResponse.id}
                    rating={sampleResponse.rating}
                    scale={sampleResponse.scale}
                  />
                )}
                {sampleResponse && (
                  <ResponsePill
                    rating={sampleResponse.rating}
                    scale={sampleResponse.scale}
                  />
                )}
                {sampleSurvey && (
                  <SurveyPill
                    id={sampleSurvey.id}
                    name={sampleSurvey.name}
                    metric={sampleSurvey.metric}
                  />
                )}
                <CompanyPill name="Bloom Beauty Co." />
              </div>
            </BothModes>

            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {PILL_INTERACTIVE_NOTES.map((s, i) => (
                <p key={i} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span>{s}</span>
                </p>
              ))}
            </div>
          </Subsection>

          {/* ── Stateful pills (every variant the codebase uses) ── */}
          <Subsection
            title="Stateful pills"
            description="All variants currently in use. text-xs is allowed here by CLAUDE.md."
          >
            <BothModes>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Ticket status
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill status="open" />
                    <StatusPill status="pending" />
                    <StatusPill status="solved" />
                    <StatusPill status="closed" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Ticket priority
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PriorityPill priority="low" />
                    <PriorityPill priority="normal" />
                    <PriorityPill priority="high" />
                    <PriorityPill priority="urgent" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Ticket channel
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ChannelPill channel="email" />
                    <ChannelPill channel="chat" />
                    <ChannelPill channel="phone" />
                    <ChannelPill channel="social" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Customer tier
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TierPill tier="insider" />
                    <TierPill tier="gold" />
                    <TierPill tier="elite" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Team role / group
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TeamPill team="Front line" />
                    <TeamPill team="Senior" />
                    <TeamPill team="Specialist" />
                    <TeamGroupPill name="Customer Care" />
                    <TeamGroupPill name="Returns & Exchanges" />
                    <TeamGroupPill name="Online Orders" />
                    <TeamGroupPill name="Stores & BOPIS" />
                    <TeamGroupPill name="Loyalty & VIP" />
                    <TeamGroupPill name="Escalations" />
                  </div>
                </div>
              </div>
            </BothModes>

            <div className="mt-4 space-y-2">
              {STATEFUL_PILL_DRIFT.map((s, i) => (
                <DriftMark
                  key={i}
                  drift={{ kind: "drift", reason: s }}
                />
              ))}
            </div>
          </Subsection>

          {/* ── Buttons ── */}
          <Subsection
            title="Buttons"
            description="Only variants and sizes actually called in src/ are shown."
          >
            <BothModes>
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Variants (size=default)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {BUTTON_VARIANTS_IN_USE.map((v) => (
                      <div
                        key={v.variant}
                        className="flex flex-col items-start gap-1"
                      >
                        <Button variant={v.variant} className="cursor-pointer">
                          <Plus />
                          {v.variant}
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          {v.uses}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Sizes (variant=default)
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {BUTTON_SIZES_IN_USE.map((s) => (
                      <div
                        key={s.size}
                        className="flex flex-col items-start gap-1"
                      >
                        <Button size={s.size} className="cursor-pointer">
                          {s.size}
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          {s.note}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Icon-only (icon size, ghost — common pattern)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="cursor-pointer"
                    >
                      <MoreHorizontal />
                    </Button>
                  </div>
                </div>
              </div>
            </BothModes>

            <div className="mt-4">
              <DriftMark
                drift={{
                  kind: "drift",
                  reason:
                    'Button size="sm" uses text-[0.8rem] (12.8px) — bypasses both text-xs (12) and the overridden text-sm (15).',
                }}
              />
            </div>
          </Subsection>

          {/* ── Avatars ── */}
          <Subsection
            title="Avatars"
            description="Four sizes; the two smaller use arbitrary text sizes inside the primitive."
          >
            <BothModes>
              <div className="flex flex-wrap items-end gap-6">
                {AVATAR_SIZES.map((a) => (
                  <div
                    key={a.size}
                    className="flex flex-col items-center gap-2"
                  >
                    <Avatar bg="#6366f1" initials="CR" imageUrl={dicebearUrl("CR")} size={a.size} />
                    <div className="text-center">
                      <div className="text-sm font-medium">size={a.size}</div>
                      <div className="text-sm text-muted-foreground">
                        {a.px} · {a.text}
                      </div>
                      {a.drift && (
                        <div className="mt-2">
                          <DriftMark drift={a.drift} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </BothModes>

            <div className="mt-4">
              <DriftMark
                drift={{
                  kind: "drift",
                  reason:
                    "Avatar bg is set inline from a 16-color hex rainbow in src/lib/color-from-name.ts — a decorative palette that lives entirely outside the design token system. No DESIGN.md entry.",
                }}
              />
            </div>
          </Subsection>

          {/* ── Status indicators ── */}
          <Subsection
            title="Status indicators (ratings & stats)"
            description="StarRating, AvgRating, StatCard — all undocumented in DESIGN.md."
          >
            <BothModes>
              <div className="space-y-6">
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    StarRating (size=md and sm)
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <StarRating value={5} scale={5} size="md" />
                    <StarRating value={3} scale={5} size="md" />
                    <StarRating value={4} scale={5} size="sm" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    AvgRating (tone thresholds)
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <AvgRating value={4.6} size="md" />
                    <AvgRating value={3.4} size="md" />
                    <AvgRating value={2.1} size="md" />
                    <AvgRating value={null} size="md" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    StatCard
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Total tickets" value="1,243" />
                    <StatCard
                      label="Avg rating"
                      value="4.6"
                      tone="text-green-dark"
                    />
                  </div>
                </div>
              </div>
            </BothModes>

            <div className="mt-4 space-y-2">
              <DriftMark
                drift={{
                  kind: "drift",
                  reason:
                    "StarRating hardcodes fill-amber-400 / fill-zinc-200; AvgRating's tone helper hardcodes text-red-600 / text-amber-600 / text-emerald-600. Neither is routed through tokens.",
                }}
              />
              <DriftMark
                drift={{
                  kind: "drift",
                  reason:
                    "StatCard label is text-xs uppercase tracking-wide — three CLAUDE.md violations in one element (text-xs for label, forced uppercase, tracking).",
                }}
              />
            </div>
          </Subsection>

          {/* ── Sections, lists, tags ── */}
          <Subsection
            title="Sections, tags, kbd, badge"
            description="Containers and small primitives."
          >
            <BothModes>
              <div className="space-y-6">
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Tag (text-xs by definition)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Tag>VIP</Tag>
                    <Tag>Refund</Tag>
                    <Tag>Wholesale</Tag>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Kbd (text-[10px] — allowed per CLAUDE.md)
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Kbd>⌘</Kbd>
                    <Kbd>K</Kbd>
                    <span className="text-muted-foreground">/</span>
                    <Kbd>⌘</Kbd>
                    <Kbd>L</Kbd>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Badge (shadcn primitive — note that bespoke &ldquo;DEMO&rdquo; pills
                    duplicate this)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                  </div>
                </div>
              </div>
            </BothModes>
          </Subsection>

          {/* ── Tables side-by-side (EntityTable vs PivotTable) ── */}
          <Subsection
            title="Table headers — EntityTable vs PivotTable"
            description="Same product, two different rendering conventions placed adjacent."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border">
                <div className="border-b border-border px-3 py-2 text-sm font-semibold">
                  EntityTable
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Subject
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Customer
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="px-3 py-2">Order #12321 — refund</td>
                      <td className="px-3 py-2">
                        <StatusPill status="open" />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        Charlotte Reyes
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">Promo code not working</td>
                      <td className="px-3 py-2">
                        <StatusPill status="solved" />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        Marisol Tan
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="border-t border-border px-3 py-2 text-sm text-muted-foreground">
                  Headers: <span className="font-mono">text-sm font-medium</span>
                </div>
              </div>

              <div className="rounded-lg border border-border">
                <div className="border-b border-border px-3 py-2 text-sm font-semibold">
                  PivotTable
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="bg-muted/40 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Region
                      </th>
                      <th className="border-l border-border bg-muted/40 px-3 py-2 text-center text-xs font-medium text-foreground">
                        EMEA
                      </th>
                      <th className="border-l border-border bg-muted/40 px-3 py-2 text-center text-xs font-medium text-foreground">
                        APAC
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">
                        Insider
                      </td>
                      <td className="px-3 py-1.5 text-right text-sm tabular-nums">
                        421
                      </td>
                      <td className="px-3 py-1.5 text-right text-sm tabular-nums">
                        388
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="border-t border-border px-3 py-2 text-sm text-muted-foreground">
                  Headers: <span className="font-mono">text-xs font-medium</span>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <DriftMark
                drift={{
                  kind: "drift",
                  reason:
                    "PivotTable column headers (8 occurrences) use text-xs while EntityTable headers use text-sm. Same product, two different conventions. Per CLAUDE.md the table cell / header rule is text-sm.",
                }}
              />
            </div>
          </Subsection>

          <DriftFooter
            title="Components — used but undocumented in DESIGN.md / ARCHITECTURE.md"
            items={UNDOCUMENTED_BUT_USED}
          />
        </Section>

        {/* ─────────────────────────  closing  ───────────────────────── */}
        <footer className="mt-20 flex items-center justify-between border-t border-border pt-6 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">/design</span>{" "}
            — single-page audit. Not in nav.
          </span>
          <a
            href="#typography"
            className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
          >
            Back to top
            <ArrowRight size={14} className="-rotate-90" />
          </a>
        </footer>
      </main>
    </div>
  );
}
