export const dynamic = "force-dynamic";

import { AlertCircle, ArrowRight, CheckCircle2, MoreHorizontal, Plus } from "lucide-react";
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
import { diffDarkOverrides, loadGlobalsCss } from "@/lib/css-token-diff";

// ----------------------------------------------------------------------------
// Audit data — frozen at 2026-05-22 (post-sweep refresh).
//
// PR #17's mechanical sweep landed 2026-05-21 and resolved most of the items
// in the prior snapshot. This audit re-greps src/ and reports the *current*
// state — items still drifting, items recently endorsed as doc-exceptions,
// and items where the pattern is now correct.
//
// Subsequent PRs through 2026-05-22 (#19–#30) added features but did not
// reintroduce drift. The pre-sweep audit lives at /design/2026-05-21 for
// historical comparison.
// ----------------------------------------------------------------------------

type Drift = { kind: "doc-exception" | "drift" | "unused" | "resolved"; reason: string };

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
    intent: "Section H1 on dashboards / metric cards",
    uses: 4,
    sample: "Dashboard heading",
    drift: {
      kind: "resolved",
      reason:
        "promoted from undocumented to a real ladder step in DESIGN.md → Size ladder",
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
    intent: "Centerpiece content — feed-card comment, message-bubble body",
    uses: 3,
    sample: "Centerpiece content reads at this size.",
    drift: {
      kind: "resolved",
      reason:
        "added to DESIGN.md → Size ladder during the sweep; applied to chat-message bubbles and feed-card comment text",
    },
  },
  {
    cls: "text-base",
    computed: "15 / 22  (overridden from Tailwind default 16 / 20)",
    intent: "Body, nav, table cells & headers, property labels, drawer body",
    uses: 78,
    sample: "Body, nav, table cells, drawer body.",
  },
  {
    cls: "text-sm",
    computed: "14 / 20",
    intent: "Stateful pills (status / priority / channel / tier), filter & toolbar chrome",
    uses: 133,
    sample: "Pill content / toolbar chrome.",
  },
  {
    cls: "text-xs",
    computed: "12 / 16",
    intent: "kbd, avatar initials, popover chips, rare tight chrome",
    uses: 55,
    sample: "kbd / popover-chip / tight-chrome content.",
    drift: {
      kind: "drift",
      reason:
        "~25 of 55 occurrences still sit outside the allowed list (DESIGN.md → Forbidden: \"smallness comes from muted color, not smaller text\") — see breakdown below",
    },
  },
];

const ARBITRARY_SIZES: Array<{
  spec: string;
  uses: number;
  where: string;
  drift?: Drift;
}> = [
  {
    spec: "text-[14px]",
    uses: 3,
    where: "ui/calendar.tsx — caption label + day cells (shadcn primitive default; off-limits to edit)",
    drift: {
      kind: "doc-exception",
      reason:
        "shadcn CLI primitive; CLAUDE.md → Conventions limits us to add-only via the shadcn CLI",
    },
  },
  {
    spec: "text-[12px]",
    uses: 1,
    where: "ui/calendar.tsx — weekday header (shadcn primitive default)",
    drift: {
      kind: "doc-exception",
      reason: "shadcn CLI primitive; off-limits to edit",
    },
  },
  {
    spec: "text-[10px]",
    uses: 1,
    where: "ui/kbd.tsx — kbd primitive body",
    drift: {
      kind: "doc-exception",
      reason:
        "shadcn-style primitive — CLAUDE.md → Font sizes explicitly allows tight chrome here",
    },
  },
  {
    spec: "text-[0.8rem]",
    uses: 1,
    where: "ui/button.tsx size=\"sm\" (12.8px — bypasses both text-xs (12) and text-sm (14))",
    drift: {
      kind: "drift",
      reason:
        "Button size=\"sm\" still maps to an off-ladder value. Either map to text-xs or drop size=\"sm\" in favor of size=\"xs\" (already declared)",
    },
  },
];

const TEXT_XS_VIOLATIONS: Array<{ file: string; note: string }> = [
  {
    file: "components/shell/search-palette.tsx",
    note: "4 occurrences — cmdk group heading, ellipsis, file-path footer, footer kbd group. Search palette chrome.",
  },
  {
    file: "components/shared/sort-control.tsx",
    note: "5 occurrences — column buttons + dropdown labels. Could shift to text-sm + muted-foreground per DESIGN.md → de-emphasis via color.",
  },
  {
    file: "components/shared/group-control.tsx:99",
    note: "1 occurrence — dropdown menu label",
  },
  {
    file: "components/shared/filter-row.tsx:574",
    note: "1 occurrence — filter group label (text-xs font-medium)",
  },
  {
    file: "components/shared/columns-control.tsx",
    note: "3 occurrences — show-all / hide-all buttons + \"always\" label",
  },
  {
    file: "components/shared/layout-toggle.tsx:33",
    note: "1 occurrence — toggle button labels",
  },
  {
    file: "components/reports/axis-zone.tsx:100",
    note: "1 occurrence — drop-zone group label",
  },
  {
    file: "components/reports/property-rail.tsx:42",
    note: "1 occurrence — rail group label",
  },
  {
    file: "components/reports/ai-prompt-dialog.tsx",
    note: "2 occurrences — \"Try one of\" label + example chips",
  },
  {
    file: "components/responses/response-feed-card.tsx:111",
    note: "1 occurrence — comment-count badge over avatar",
  },
  {
    file: "components/tickets/ticket-activity.tsx:287",
    note: "1 occurrence — hover-revealed timestamp on chat bubbles",
  },
  {
    file: "components/surveys/survey-detail.tsx:104",
    note: "1 occurrence — meta line on survey detail",
  },
  {
    file: "app/(workspace)/page.tsx",
    note: "3 occurrences — \"What's new\" feed metadata / links on workspace home",
  },
  {
    file: "components/shared/tag.tsx:3",
    note: "Tag primitive is text-xs by definition (1 instance in src/). Component itself is the drift — either retire or define what \"Tag\" is for vs. all the other pills.",
  },
  {
    file: "lib/properties/{customers,team-members,tickets,responses,surveys,response-answers}.tsx",
    note: "font-mono text-xs ID cells in 6 registries — formally a violation; endorsed by ARCHITECTURE.md → Property registry → \"detail override pattern\" as a documented exception",
  },
];

// Tier 1 production hue palette — the source of truth as of DESIGN.md →
// "Production hue palette". 7 hues × 5 shades + black + white. Hues do NOT
// flip between light and dark mode.
const TIER1_HUES: Array<{ name: string; shades: string[] }> = [
  { name: "grey", shades: ["grey-darker", "grey-dark", "grey", "grey-light", "grey-lighter"] },
  { name: "blue", shades: ["blue-darker", "blue-dark", "blue", "blue-light", "blue-lighter"] },
  { name: "green", shades: ["green-darker", "green-dark", "green", "green-light", "green-lighter"] },
  { name: "red", shades: ["red-darker", "red-dark", "red", "red-light", "red-lighter"] },
  { name: "purple", shades: ["purple-darker", "purple-dark", "purple", "purple-light", "purple-lighter"] },
  { name: "teal", shades: ["teal-darker", "teal-dark", "teal", "teal-light", "teal-lighter"] },
  { name: "yellow", shades: ["yellow-darker", "yellow-dark", "yellow", "yellow-light", "yellow-lighter"] },
];

// Tier 2 structural-semantic aliases — flip per mode, alias Tier 1 where applicable.
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
            "declared but body still uses bg-background; held off pending the layered grey-canvas + white-cards decision (DESIGN.md → Migration notes)",
        },
      },
    ],
  },
  {
    title: "Text",
    tokens: [
      { token: "foreground", use: "Primary text — aliases var(--black)" },
      { token: "muted-foreground", use: "Secondary metadata (emails, IDs, dates)" },
      {
        token: "foreground-light",
        use: "Tertiary text / hints",
        drift: { kind: "unused", reason: "declared, 0 utility uses in src/ — rarely needed" },
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
      { token: "primary", use: "Primary actions, focus rings, active nav — aliases var(--blue)" },
      { token: "primary-foreground", use: "Text on primary" },
      { token: "primary-hover", use: "Hover state — aliases var(--blue-dark)" },
      {
        token: "primary-down",
        use: "Pressed state — aliases var(--blue-darker)",
        drift: { kind: "unused", reason: "declared, 0 utility uses in src/ (wired but no pressed-state UI yet)" },
      },
    ],
  },
  {
    title: "Destructive",
    tokens: [
      {
        token: "destructive",
        use: "Destructive button + danger ring — aliases var(--red-dark)",
        drift: {
          kind: "resolved",
          reason:
            "now documented in DESIGN.md → Primary as the structural alias for destructive actions (the sweep made it explicit)",
        },
      },
    ],
  },
  {
    title: "Borders & focus",
    tokens: [
      { token: "border", use: "Default subtle border (10% black)" },
      { token: "border-strong", use: "Emphasis border (20% black)" },
      { token: "border-solid", use: "Opaque divider for non-white surfaces" },
      { token: "input", use: "Form input border" },
      { token: "ring", use: "Focus ring — aliases var(--blue)" },
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
      { token: "icon-responses", use: "Responses — aliases var(--blue)" },
      { token: "icon-customers", use: "Customers — aliases var(--purple)" },
      { token: "icon-team-members", use: "Team members — aliases var(--teal)" },
      { token: "icon-tickets", use: "Tickets — aliases var(--yellow-dark)" },
      { token: "icon-reports", use: "Reports — aliases var(--green)" },
    ],
  },
  {
    title: "Charts (Recharts)",
    tokens: [
      {
        token: "chart-1",
        use: "Series 1 — aliases var(--blue)",
        drift: {
          kind: "resolved",
          reason: "chart-1..6 now alias Tier 1 hues; previously declared as greyscale oklch shadcn defaults",
        },
      },
      { token: "chart-2", use: "Series 2 — aliases var(--green)" },
      { token: "chart-3", use: "Series 3 — aliases var(--yellow)" },
      { token: "chart-4", use: "Series 4 — aliases var(--red)" },
      { token: "chart-5", use: "Series 5 — aliases var(--purple)" },
      { token: "chart-6", use: "Series 6 — aliases var(--teal) (added in sweep)" },
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
  "Avatar background palette — 16 raw hex colors in src/lib/color-from-name.ts, deterministic name-to-color mapping. Decorative-rainbow scale outside the production-hue palette. No DESIGN.md entry for a decorative-rainbow scale; either route to Tier 1 (lose visual variety) or document the scale as its own thing.",
  "State-semantic tokens (--positive, --negative, --neutral, --info, --brand) are gone — DESIGN.md → \"Two-tier token system\" explicitly avoids them now. Pills reach into Tier 1 hues directly (bg-green-lighter for solved, bg-red-lighter for urgent). If a true alias becomes worthwhile later (e.g., --success in 20+ sites), revisit then.",
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
  { cls: "shadow-none", use: "Default — borders-first product" },
  { cls: "shadow-md", use: "Radix HoverCard / Popover / Dropdown / Select / Tooltip" },
  { cls: "shadow-lg", use: "Radix Sheet / report-builder drag overlay / Toast" },
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
    uses: 54,
    note:
      "still very common — every stateful pill uses py-0.5, plus widespread mt/mb/mx-0.5 micro-nudges. The pill convention has diverged from the documented scale without being formally documented.",
  },
  {
    utility: "*-1.5",
    px: 6,
    uses: 102,
    note:
      "the second most-common gap utility in the codebase. Used in dropdowns, pill icon gaps, popover dividers, toolbar chrome.",
  },
  {
    utility: "*-2.5",
    px: 10,
    uses: 7,
    note: "shadcn dropdown content padding and a few labels — inherited from shadcn primitives",
  },
  {
    utility: "*-3.5",
    px: 14,
    uses: 0,
    note: "not in use",
  },
];

const PILL_INTERACTIVE_NOTES: string[] = [
  "Interactive entity pills (Customer, TeamMember, Ticket, Response w/ id, Survey) share a strict shape: rounded -mx-1 px-1 py-0.5, bg-accent/40, hover bg-accent, always-visible ArrowUpRight, popover on hover, drawer on click.",
  "CompanyPill (right, plain text) intentionally breaks the shape per CLAUDE.md — company is a string, not yet an entity. The visual gap is doing real work: the lack of an arrow says \"don't click me\".",
  "ResponsePill swaps between the interactive shape (with id) and a plain span (without id) — same component name, two visual modes. The rendering happens at the property registry level.",
];

const STATEFUL_PILL_NOTES: string[] = [
  "All stateful pills (status / priority / channel / tier / team / team-group / survey status) now use bg-{hue}-lighter text-{hue}-darker production-hue token pairs. Text size is text-sm (bumped from text-xs in the sweep). No raw Tailwind hues, no opacity tricks, no ring-1 chrome.",
  "Hue mapping is explicit in DESIGN.md → Migration notes → \"Landed in the mechanical sweep\". The choice of which hue maps to which state is editorial — change a state's hue by editing one Record<…, string> in the pill component.",
];

const BUTTON_VARIANTS_IN_USE: Array<{
  variant: "default" | "outline" | "secondary" | "ghost";
  uses: string;
}> = [
  { variant: "default", uses: "default (no explicit variant)" },
  { variant: "outline", uses: "explicit uses" },
  { variant: "secondary", uses: "Cancel pair in dialogs" },
  { variant: "ghost", uses: "explicit uses" },
];

const BUTTON_SIZES_IN_USE: Array<{
  size: "default" | "sm" | "lg";
  note: string;
}> = [
  { size: "default", note: "default" },
  {
    size: "sm",
    note:
      "still uses text-[0.8rem] (12.8px) — bypasses text-xs (12) and text-sm (14). One remaining off-ladder size in ui/.",
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
    text: "text-xs",
    drift: {
      kind: "resolved",
      reason: "swept from text-[10px] to text-xs — now on the documented ladder",
    },
  },
  {
    size: "md",
    px: "24px",
    text: "text-xs",
    drift: {
      kind: "resolved",
      reason: "swept from text-[11px] to text-xs",
    },
  },
  { size: "lg", px: "36px", text: "text-sm" },
  { size: "xl", px: "40px", text: "text-base" },
];

const UNDOCUMENTED_BUT_USED: string[] = [
  "Avatar bg palette — 16 raw hex colors (`#ef4444`, `#f97316`, `#f59e0b`, …) in src/lib/color-from-name.ts, deterministic name-to-color mapping. No DESIGN.md entry. Either route through Tier 1 hues (lose visual variety) or formally document the decorative-rainbow scale as its own thing.",
  "Tag primitive — text-xs by definition; used 1× in src/. Either retire (Badge variant=\"secondary\" covers most cases) or define what \"Tag\" is for vs. the other small primitives.",
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
        : drift.kind === "resolved"
          ? "bg-green-lighter text-green-darker"
          : "bg-muted text-muted-foreground";
  const label =
    drift.kind === "drift"
      ? "drift"
      : drift.kind === "doc-exception"
        ? "doc exception"
        : drift.kind === "resolved"
          ? "resolved in sweep"
          : "unused";
  return (
    <span
      className={`inline-flex items-start gap-1.5 rounded px-2 py-0.5 text-sm ${tone}`}
    >
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-80" />
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
        <p className="mt-2 max-w-prose text-base text-muted-foreground">
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
          <span className="text-base text-muted-foreground">{description}</span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DriftFooter({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-border-strong bg-muted/40 p-5">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <AlertCircle size={16} className="text-muted-foreground" />
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-base text-foreground/90">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResolvedFooter({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-green-light bg-green-lighter/30 p-5">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <CheckCircle2 size={16} className="text-green-dark" />
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-base text-foreground/90">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2.5 size-1 shrink-0 rounded-full bg-green-dark/70" />
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
        <div className="mb-3 text-base font-medium text-muted-foreground">
          Light
        </div>
        {children}
      </div>
      <div className={`dark ${innerCls}`}>
        <div className="mb-3 text-base font-medium text-muted-foreground">
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
  // Also parse globals.css to diff :root against .dark for the dark-mode
  // override audit.
  const [customers, teamMembers, tickets, responses, surveys, globalsCss] =
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
      loadGlobalsCss(),
    ]);

  const sampleCustomer = customers.rows[0];
  const sampleTeamMember = teamMembers.rows[0];
  const sampleTicket = tickets.rows[0];
  const sampleResponse = responses.rows[0];
  const sampleSurvey = surveys[0];

  const darkDiff = diffDarkOverrides(globalsCss);
  const flaggedCount = darkDiff.missingFromDark.filter(
    (m) => m.classification === "flag",
  ).length;
  const nonColorCount = darkDiff.missingFromDark.filter(
    (m) => m.classification === "non-color",
  ).length;

  return (
    <div className="flex-1 min-w-0">
      <Topbar crumbs={[{ label: "Design audit" }]} />

      <main className="mx-auto max-w-6xl px-10 py-10 xl:px-14">
        <header className="border-b border-border pb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Design audit
          </h1>
          <p className="mt-3 max-w-prose text-base text-muted-foreground">
            A single-page audit of where this prototype&apos;s tokens, type scale,
            and components have drifted from the rules in CLAUDE.md and
            DESIGN.md. This is not a component gallery — every section puts
            real, live components next to the documented rule so drift is
            visible at a glance.
          </p>
          <p className="mt-3 max-w-prose text-base text-muted-foreground">
            Counts frozen 2026-05-22 (post-sweep). PR #17&apos;s mechanical
            sweep resolved most of the drift surfaced by the pre-sweep snapshot —
            raw Tailwind hues out of pills, type ladder applied to call sites,
            arbitrary text sizes mapped to ladder steps. What remains is
            either narrowly scoped (text-xs in chrome, ui/ primitive defaults)
            or genuinely orthogonal to the sweep (avatar decorative palette,
            spacing micro-utilities). Colors read live from{" "}
            <span className="font-mono">var(--token)</span> in{" "}
            <span className="font-mono">globals.css</span> — swatches stay in
            sync with the token source.
          </p>
          <div className="mt-5">
            <Link
              href="/design/2026-05-21"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-base text-foreground hover:bg-accent/40"
            >
              View pre-sweep audit (2026-05-21)
              <ArrowRight size={14} />
            </Link>
          </div>
          <nav className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-base">
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
              <span className="ml-3 inline-flex size-2 rounded-full bg-green" />
              resolved
              <span className="ml-3 inline-flex size-2 rounded-full bg-muted-foreground/60" />
              unused
            </span>
          </nav>
        </header>

        {/* ─────────────────────────  § 1 TYPOGRAPHY  ───────────────────────── */}
        <Section
          id="typography"
          title="1. Typography"
          intro="Every text-* class actually present in src/, at its real size, with the documented intended use and the count of occurrences (audit pages excluded). Items the sweep promoted to documented ladder steps are tagged 'resolved'."
        >
          <Subsection title="Type ladder">
            <div className="divide-y divide-border rounded-lg border border-border">
              {TYPOGRAPHY_ROWS.map((row) => (
                <div
                  key={row.cls}
                  className="grid grid-cols-[150px_140px_1fr_60px] items-center gap-4 px-5 py-4"
                >
                  <div>
                    <div className="font-mono text-base">{row.cls}</div>
                    <div className="mt-1 text-base text-muted-foreground">
                      {row.computed}px
                    </div>
                  </div>
                  <div className="text-base text-muted-foreground">
                    {row.intent}
                  </div>
                  <div className={`${row.cls} truncate text-foreground`}>
                    {row.sample}
                  </div>
                  <div className="text-right tabular-nums text-base text-muted-foreground">
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
            description="Allowed only for kbd, avatar initials, popover chips, and rare tight chrome."
          >
            <div className="rounded-lg border border-border">
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-base hover:bg-muted/40">
                  <span>
                    <span className="font-medium">
                      {TEXT_XS_VIOLATIONS.length} location
                      {TEXT_XS_VIOLATIONS.length === 1 ? "" : "s"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      where text-xs is used outside the allowed list
                    </span>
                  </span>
                  <span className="text-base text-muted-foreground group-open:hidden">
                    expand
                  </span>
                  <span className="text-base text-muted-foreground hidden group-open:inline">
                    collapse
                  </span>
                </summary>
                <ul className="divide-y divide-border border-t border-border">
                  {TEXT_XS_VIOLATIONS.map((v) => (
                    <li key={v.file} className="px-5 py-3 text-base">
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
            description="Every text-[…px] occurrence in src/. All confined to ui/ primitives post-sweep."
          >
            <div className="divide-y divide-border rounded-lg border border-border">
              {ARBITRARY_SIZES.map((row) => (
                <div
                  key={row.spec}
                  className="grid grid-cols-[160px_60px_1fr] items-start gap-4 px-5 py-3"
                >
                  <div className="font-mono text-base">{row.spec}</div>
                  <div className="text-right tabular-nums text-base text-muted-foreground">
                    {row.uses} use{row.uses === 1 ? "" : "s"}
                  </div>
                  <div className="space-y-2">
                    <div className="text-base text-muted-foreground">{row.where}</div>
                    {row.drift && <DriftMark drift={row.drift} />}
                  </div>
                </div>
              ))}
            </div>
          </Subsection>

          <ResolvedFooter
            title="Typography — what the sweep resolved"
            items={[
              "text-lg promoted from an undocumented one-off to a real ladder step (DESIGN.md → Size ladder = 18px, centerpiece content). Now used in chat-message bubbles and response feed-card comments.",
              "text-2xl promoted from undocumented to documented as the dashboard-H1 / metric-card step (DESIGN.md → Size ladder).",
              "EntityTable cells & headers, property-list, topbar, primary-nav, drawer chrome, detail-page values: text-sm → text-base. Pills: text-xs → text-sm.",
              "All call-site arbitrary text-[Npx] occurrences mapped to ladder steps. Remaining 6 are shadcn primitive defaults (calendar / button / kbd) — see above.",
              "StatCard label: dropped uppercase + tracking + text-xs in favor of text-sm text-muted-foreground (\"smallness comes from color, not size\").",
              "PivotTable headers: text-xs → text-base, matching EntityTable convention.",
            ]}
          />
        </Section>

        {/* ─────────────────────────  § 2 TOKENS  ───────────────────────── */}
        <Section
          id="tokens"
          title="2. Tokens"
          intro="Two-tier system. Tier 1 is the production hue palette (Simplesat design system) — call sites consume directly. Tier 2 names structural roles (foreground, background, border) and aliases Tier 1 where applicable. State-semantic tokens (--positive / --negative / --neutral / --info / --brand) were removed during the sweep — DESIGN.md → 'Two-tier token system' explains why."
        >
          {/* ── Tier 1: Production hue palette ── */}
          <Subsection
            title="Tier 1 — Production hue palette"
            description="Seven chromatic hues × 5 shades + black + white. Source of truth; hues do NOT flip between light and dark mode."
          >
            <div className="space-y-3">
              {TIER1_HUES.map((hue) => (
                <div
                  key={hue.name}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="font-mono text-base font-medium capitalize">
                      {hue.name}
                    </div>
                    <div className="text-base text-muted-foreground">
                      darker → lighter
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {hue.shades.map((shade) => (
                      <div key={shade} className="space-y-2">
                        <div
                          aria-hidden
                          className="h-14 rounded-md border border-border-strong"
                          style={{ background: `var(--${shade})` }}
                        />
                        <div className="font-mono text-base text-foreground">
                          --{shade}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="mb-3 font-mono text-base font-medium">
                  Black + white
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {["black", "white"].map((t) => (
                    <div key={t} className="space-y-2">
                      <div
                        aria-hidden
                        className="h-14 rounded-md border border-border-strong"
                        style={{ background: `var(--${t})` }}
                      />
                      <div className="font-mono text-base text-foreground">
                        --{t}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Subsection>

          {/* ── Tier 2: Structural-semantic aliases ── */}
          <Subsection
            title="Tier 2 — Structural-semantic aliases"
            description="Name roles (foreground, background, border). Flip per mode. Alias Tier 1 hues where applicable. Light and dark render simultaneously."
          >
            <div className="space-y-6">
              {COLOR_GROUPS.map((group) => (
                <div key={group.title}>
                  <h4 className="text-base font-semibold text-foreground">
                    {group.title}
                  </h4>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(["light", "dark"] as const).map((mode) => (
                      <div
                        key={mode}
                        className={`${mode === "dark" ? "dark " : ""}rounded-lg border border-border bg-background p-4`}
                      >
                        <div className="mb-3 text-base font-medium text-muted-foreground">
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
                                <div className="font-mono text-base text-foreground">
                                  --{t.token}
                                </div>
                                <div className="text-base text-muted-foreground">
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
              title="Color tokens — what remains"
              items={COLOR_FOOTER_DRIFT}
            />
            <ResolvedFooter
              title="Color tokens — what the sweep resolved"
              items={[
                "All raw Tailwind hue classes (bg-red-50, bg-amber-50, bg-blue-50, …) removed from non-ui code. Stateful pills now use bg-{hue}-lighter text-{hue}-darker. The matches you may still see in src/ are inside this audit page's string literals describing prior state.",
                "Deprecated state-semantic tokens removed: --positive, --negative, --neutral, --info, --brand and their @theme inline mappings deleted from globals.css. All consumers migrated to Tier 1 hues.",
                "--foreground, --primary, --primary-hover, --primary-down, --ring, --destructive now alias Tier 1 hues (--black, --blue, --blue-dark, --blue-darker, --red-dark). One-line color edits flow through these aliases.",
                "Nav icon palette migrated: --icon-customers (pink → purple), --icon-team-members (purple → teal), --icon-tickets (orange → yellow-dark). Every nav row now reads as a distinct production hue.",
                "Chart series (--chart-1..6) point at Tier 1 hues instead of greyscale shadcn defaults. Ready for Reports.",
              ]}
            />
          </Subsection>

          {/* ── Dark-mode override coverage ── */}
          <Subsection
            title="Dark-mode override coverage"
            description="Every --token declared in :root, diffed against .dark. Tokens that intentionally don't flip per mode (--black, --white, and base / -light / -dark per Tier-1 hue — 23 in total) are allow-listed as documented exceptions; everything else is expected to be overridden."
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label=":root tokens"
                value={String(darkDiff.rootTokenCount)}
              />
              <StatCard
                label=".dark overrides"
                value={String(darkDiff.darkTokenCount)}
              />
              <StatCard
                label="Allow-listed"
                value={String(darkDiff.allowListed.length)}
              />
              <StatCard
                label="Flagged"
                value={String(flaggedCount)}
                tone={flaggedCount > 0 ? "text-red-dark" : "text-green-dark"}
              />
            </div>

            <div className="mt-6">
              {darkDiff.missingFromDark.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-dashed border-green-light bg-green-lighter/30 p-5 text-base text-foreground/90">
                  <CheckCircle2
                    size={16}
                    className="mt-1 shrink-0 text-green-dark"
                  />
                  <span>
                    Every <span className="font-mono">:root</span> token outside
                    the absolute-shade allow-list is overridden in{" "}
                    <span className="font-mono">.dark</span>. No drift.
                  </span>
                </div>
              ) : (
                <div className="rounded-lg border border-border">
                  <div className="grid grid-cols-[1fr_220px_1fr] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-base font-medium text-muted-foreground">
                    <span>Token</span>
                    <span>:root value</span>
                    <span>Classification</span>
                  </div>
                  <div className="divide-y divide-border">
                    {darkDiff.missingFromDark.map((m) => (
                      <div
                        key={m.name}
                        className="grid grid-cols-[1fr_220px_1fr] items-start gap-4 px-5 py-3 text-base"
                      >
                        <span className="font-mono text-foreground">
                          {m.name}
                        </span>
                        <span className="font-mono text-muted-foreground truncate">
                          {m.rootValue}
                        </span>
                        <span>
                          {m.classification === "flag" ? (
                            <DriftMark
                              drift={{
                                kind: "drift",
                                reason:
                                  "Declared in :root but not redefined in .dark — color token will reuse light-mode value on a dark canvas.",
                              }}
                            />
                          ) : (
                            <DriftMark
                              drift={{
                                kind: "doc-exception",
                                reason:
                                  "Non-color sizing token (radius scale). Intentionally constant across modes.",
                              }}
                            />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <details className="mt-6 rounded-lg border border-dashed border-border-strong bg-muted/40 group">
              <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-base hover:bg-muted/40">
                <span>
                  <span className="font-medium">Allow-list</span>{" "}
                  <span className="text-muted-foreground">
                    ({darkDiff.allowListed.length} absolute-shade tokens that
                    intentionally don&apos;t flip per mode)
                  </span>
                </span>
                <span className="text-base text-muted-foreground group-open:hidden">
                  expand
                </span>
                <span className="text-base text-muted-foreground hidden group-open:inline">
                  collapse
                </span>
              </summary>
              <div className="border-t border-border-strong px-5 py-4">
                <div className="flex flex-wrap gap-x-3 gap-y-2 font-mono text-base text-muted-foreground">
                  {darkDiff.allowListed.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
              </div>
            </details>

            <p className="mt-4 max-w-prose text-base text-muted-foreground">
              Parser source: <span className="font-mono">src/lib/css-token-diff.ts</span>{" "}
              reads <span className="font-mono">src/app/globals.css</span> at
              render time and extracts every{" "}
              <span className="font-mono">--name: value;</span> declaration
              inside the <span className="font-mono">:root</span> and{" "}
              <span className="font-mono">.dark</span> blocks. The audit reflects
              the live token sheet — no hand-maintained list to drift.
              {flaggedCount === 0 && nonColorCount > 0 && (
                <>
                  {" "}
                  The {nonColorCount === 1 ? "one" : nonColorCount} non-color
                  token{nonColorCount === 1 ? "" : "s"} surfaced above{" "}
                  {nonColorCount === 1 ? "is" : "are"} expected to be constant
                  across modes.
                </>
              )}
            </p>
          </Subsection>

          {/* ── Borders & radius ── */}
          <Subsection
            title="Borders, radius, shadows"
            description="Border and focus colors swatch above; radius and shadow scales below."
          >
            <BothModes>
              <div className="space-y-3">
                {[
                  ["border", "Default"],
                  ["border-strong", "Emphasis"],
                  ["border-solid", "Opaque divider"],
                  ["input", "Form input"],
                  ["ring", "Focus ring"],
                ].map(([token, label]) => (
                  <div
                    key={token}
                    className="rounded-md border-2 p-3 text-base"
                    style={{ borderColor: `var(--${token})` }}
                  >
                    {label} — <span className="font-mono">--{token}</span>
                  </div>
                ))}
              </div>
            </BothModes>

            <div className="mt-8">
              <h4 className="text-base font-semibold">Radius scale</h4>
              <p className="mt-1 text-base text-muted-foreground">
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
                      <div className="font-mono text-base">{r.cls}</div>
                      <div className="text-base text-muted-foreground">
                        {r.multiplier} = {r.px}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <h4 className="text-base font-semibold">Shadow scale (as used)</h4>
              <p className="mt-1 text-base text-muted-foreground">
                DESIGN.md → Shadows: borders-first product, shadows only on
                Radix portals. The sweep removed the two inline-card shadows
                that violated this (drawer&apos;s shadow-2xl, tabs&apos; active-state shadow-sm).
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
                      <div className="font-mono text-base">{s.cls}</div>
                      <div className="text-base text-muted-foreground">
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
                    <div className="w-12 shrink-0 text-right font-mono text-base tabular-nums text-muted-foreground">
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
              <div className="border-b border-border px-5 py-3 text-base font-semibold">
                Off-scale utilities used in src/
              </div>
              <div className="divide-y divide-border">
                {SPACING_USED_OUTSIDE.map((row) => (
                  <div
                    key={row.utility}
                    className="grid grid-cols-[120px_70px_70px_1fr] items-center gap-4 px-5 py-3 text-base"
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
              title="Spacing — what diverged (unchanged from pre-sweep)"
              items={[
                "Every stateful pill in src/ uses py-0.5 (2px). Not on the documented scale — either add 2 as an allowed micro-step for pills or rework the pill height to land on 4/8/12.",
                "*-1.5 (6px) usage grew during feature work (sort / group / filter controls added in PRs #15–21). Either add 6 to the scale or rework downward.",
                "DESIGN.md → Defaults lists page padding 24 / 32, card padding 20, drawer 24, detail px-14 py-10 — every one of those is on-scale. The drift is entirely in micro-gaps, not in page rhythm.",
              ]}
            />
          </Subsection>
        </Section>

        {/* ─────────────────────────  § 3 COMPONENTS  ───────────────────── */}
        <Section
          id="components"
          title="3. Component inventory"
          intro="Every component variant the codebase actually uses, rendered side-by-side at the same scale so visual drift jumps out. Logical duplicates are placed adjacent."
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
                    externalId={sampleTicket.helpdeskExternalId}
                    subject={sampleTicket.subject}
                  />
                )}
                {sampleTicket && (
                  <TicketPill
                    id={sampleTicket.id}
                    externalId={sampleTicket.helpdeskExternalId}
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

            <div className="mt-4 space-y-2 text-base text-muted-foreground">
              {PILL_INTERACTIVE_NOTES.map((s, i) => (
                <p key={i} className="flex gap-2">
                  <span className="mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span>{s}</span>
                </p>
              ))}
            </div>
          </Subsection>

          {/* ── Stateful pills (every variant the codebase uses) ── */}
          <Subsection
            title="Stateful pills"
            description="All variants currently in use. Now routed through Tier 1 hues — text-sm."
          >
            <BothModes>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-base text-muted-foreground">
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
                  <div className="mb-2 text-base text-muted-foreground">
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
                  <div className="mb-2 text-base text-muted-foreground">
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
                  <div className="mb-2 text-base text-muted-foreground">
                    Customer tier
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TierPill tier="insider" />
                    <TierPill tier="gold" />
                    <TierPill tier="elite" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-base text-muted-foreground">
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
              {STATEFUL_PILL_NOTES.map((s, i) => (
                <DriftMark
                  key={i}
                  drift={{ kind: "resolved", reason: s }}
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
                  <div className="mb-2 text-base text-muted-foreground">
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
                        <div className="text-sm text-muted-foreground">
                          {v.uses}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-base text-muted-foreground">
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
                        <div className="text-sm text-muted-foreground">
                          {s.note}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-base text-muted-foreground">
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
                    "Button size=\"sm\" still uses text-[0.8rem] (12.8px) — bypasses both text-xs (12) and text-sm (14). One ui/-primitive default left over.",
                }}
              />
            </div>
          </Subsection>

          {/* ── Avatars ── */}
          <Subsection
            title="Avatars"
            description="Four sizes; sm/md mapped to text-xs during the sweep."
          >
            <BothModes>
              <div className="flex flex-wrap items-end gap-6">
                {AVATAR_SIZES.map((a) => (
                  <div
                    key={a.size}
                    className="flex flex-col items-center gap-2"
                  >
                    <Avatar bg="#6366f1" initials="CR" size={a.size} />
                    <div className="text-center">
                      <div className="text-base font-medium">size={a.size}</div>
                      <div className="text-base text-muted-foreground">
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
                    "Avatar bg is set inline from a 16-color hex rainbow in src/lib/color-from-name.ts — a decorative palette that lives entirely outside the production-hue token system. No DESIGN.md entry; orthogonal to the sweep.",
                }}
              />
            </div>
          </Subsection>

          {/* ── Status indicators ── */}
          <Subsection
            title="Status indicators (ratings & stats)"
            description="StarRating, AvgRating, StatCard — all migrated to Tier 1 hues during the sweep."
          >
            <BothModes>
              <div className="space-y-6">
                <div>
                  <div className="mb-2 text-base text-muted-foreground">
                    StarRating (size=md and sm)
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <StarRating value={5} scale={5} size="md" />
                    <StarRating value={3} scale={5} size="md" />
                    <StarRating value={4} scale={5} size="sm" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-base text-muted-foreground">
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
                  <div className="mb-2 text-base text-muted-foreground">
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
                  kind: "resolved",
                  reason:
                    "StarRating now uses fill-yellow / fill-grey-light. AvgRating tone helper now returns text-red-dark / text-yellow-dark / text-green-dark. Both routed through Tier 1 hues.",
                }}
              />
              <DriftMark
                drift={{
                  kind: "resolved",
                  reason:
                    "StatCard label dropped uppercase + tracking + text-xs in favor of text-sm text-muted-foreground.",
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
                  <div className="mb-2 text-base text-muted-foreground">
                    Tag (text-xs by definition — single use site)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Tag>VIP</Tag>
                    <Tag>Refund</Tag>
                    <Tag>Wholesale</Tag>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-base text-muted-foreground">
                    Kbd (text-[10px] — allowed per CLAUDE.md)
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-base">
                    <Kbd>⌘</Kbd>
                    <Kbd>K</Kbd>
                    <span className="text-muted-foreground">/</span>
                    <Kbd>⌘</Kbd>
                    <Kbd>L</Kbd>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-base text-muted-foreground">
                    Badge (shadcn primitive — &ldquo;Soon&rdquo; indicators now use{" "}
                    <span className="font-mono">Badge variant=&quot;secondary&quot;</span>{" "}
                    after the sweep removed inline DEMO spans)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="secondary">Soon</Badge>
                    <Badge variant="outline">Outline</Badge>
                  </div>
                </div>
              </div>
            </BothModes>
          </Subsection>

          {/* ── Tables side-by-side (EntityTable vs PivotTable) ── */}
          <Subsection
            title="Table headers — EntityTable vs PivotTable"
            description="Both now render at text-base after the sweep aligned PivotTable to EntityTable's convention."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border">
                <div className="border-b border-border px-3 py-2 text-base font-semibold">
                  EntityTable
                </div>
                <table className="w-full text-base">
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
                <div className="border-t border-border px-3 py-2 text-base text-muted-foreground">
                  Headers: <span className="font-mono">text-base font-medium</span>
                </div>
              </div>

              <div className="rounded-lg border border-border">
                <div className="border-b border-border px-3 py-2 text-base font-semibold">
                  PivotTable
                </div>
                <table className="w-full text-base">
                  <thead>
                    <tr>
                      <th className="bg-muted/40 px-3 py-2 text-left font-medium text-muted-foreground">
                        Region
                      </th>
                      <th className="border-l border-border bg-muted/40 px-3 py-2 text-center font-medium text-foreground">
                        EMEA
                      </th>
                      <th className="border-l border-border bg-muted/40 px-3 py-2 text-center font-medium text-foreground">
                        APAC
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="px-3 py-1.5 text-right text-muted-foreground">
                        Insider
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        421
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        388
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="border-t border-border px-3 py-2 text-base text-muted-foreground">
                  Headers: <span className="font-mono">text-base font-medium</span>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <DriftMark
                drift={{
                  kind: "resolved",
                  reason:
                    "Sweep aligned PivotTable headers to text-base (previously text-xs). Same product, one convention.",
                }}
              />
            </div>
          </Subsection>

          <DriftFooter
            title="Components — what remains undocumented"
            items={UNDOCUMENTED_BUT_USED}
          />
        </Section>

        {/* ─────────────────────────  closing  ───────────────────────── */}
        <footer className="mt-20 flex items-center justify-between border-t border-border pt-6 text-base text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">/design</span>{" "}
            — single-page audit. Not in nav. Pre-sweep snapshot at{" "}
            <Link
              href="/design/2026-05-21"
              className="text-primary hover:underline underline-offset-4"
            >
              /design/2026-05-21
            </Link>
            .
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
