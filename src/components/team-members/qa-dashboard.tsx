"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, X } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { DetailSection } from "@/components/shared/detail-section";
import { EntityTable } from "@/components/shared/entity-table";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { StatCard, type StatCardDelta } from "@/components/shared/stat-card";
import { EVALUATION_PROPERTIES } from "@/lib/properties/evaluations";
import { formatNumber, formatTimelineDay } from "@/lib/format";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import type {
  QaCategoryAverage,
  QaCsatCorrelationRow,
  QaRecentEvaluation,
  QaTopPoint,
  QaWeeklyTrendPoint,
  SparklinePoint,
  TeamMemberCoachingFeedItem,
  TeamMemberQaRollup,
  TeamMemberQaSparklines,
  TeamMemberQaTiles,
} from "@/db/queries/team-members";

const MIN_EVALUATIONS_FOR_CATEGORIES = 3;
const MIN_WEEKS_FOR_TREND = 2;
const MIN_COACHING_FOR_TOPLISTS = 3;
const MIN_PAIRED_FOR_CSAT = 20;
/** Normalized-score delta where we call out "meaningfully better/worse." Below
 *  this threshold we render the delta in muted text so noise reads as neutral. */
const CATEGORY_DELTA_THRESHOLD = 3;

type Props = {
  memberName: string;
  rollup: TeamMemberQaRollup;
  tiles: TeamMemberQaTiles;
  sparklines: TeamMemberQaSparklines;
  coachingFeed: TeamMemberCoachingFeedItem[];
  /** When set (drill-in from heatmap), filter evals to this category and
   *  highlight the matching row in the category breakdown. */
  focusedCategoryId?: string | null;
};

export function QaDashboard({
  memberName,
  rollup,
  tiles,
  sparklines,
  coachingFeed,
  focusedCategoryId = null,
}: Props) {
  const {
    evaluationCount,
    coachingNoteCount,
    pairedResponseCount,
    categoryAverages,
    weeklyTrend,
    strengths,
    growthAreas,
    csatCorrelations,
    recentEvaluations,
  } = rollup;

  const focusedCategory = focusedCategoryId
    ? categoryAverages.find((c) => c.categoryId === focusedCategoryId) ?? null
    : null;

  const filteredEvaluations = focusedCategoryId
    ? recentEvaluations.filter((e) => e.categoryIds.includes(focusedCategoryId))
    : recentEvaluations;

  if (evaluationCount === 0) {
    return (
      <DetailSection title="QA performance">
        <QaTilesRow tiles={tiles} sparklines={sparklines} />
        <div className="mt-4">
          <EmptyCard
            title="No evaluations yet"
            description={`${memberName} hasn't been scored on any tickets yet. Category breakdown, trend, and coaching insights will populate once evaluations roll in.`}
          />
        </div>
      </DetailSection>
    );
  }

  return (
    <DetailSection title="QA performance">
      <QaTilesRow tiles={tiles} sparklines={sparklines} />

      {focusedCategory ? (
        <CategoryFocusBanner categoryName={focusedCategory.name} />
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <QaCategoryBreakdown
          rows={categoryAverages}
          evaluationCount={evaluationCount}
          focusedCategoryId={focusedCategoryId}
        />
        <QaTrendChart
          memberName={memberName}
          points={weeklyTrend}
          evaluationCount={evaluationCount}
        />
      </div>

      <div className="mt-4">
        <QaRecentEvaluationsTable
          rows={filteredEvaluations}
          totalCount={evaluationCount}
          focusedCategoryId={focusedCategoryId}
          focusedCategoryName={focusedCategory?.name ?? null}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <QaCoachingFeed items={coachingFeed} />
        <QaStrengthsGrowth
          strengths={strengths}
          growthAreas={growthAreas}
          coachingNoteCount={coachingNoteCount}
        />
      </div>

      <div className="mt-4">
        <QaCsatCorrelation
          rows={csatCorrelations}
          pairedResponseCount={pairedResponseCount}
        />
      </div>
    </DetailSection>
  );
}

// ---------------------------------------------------------------------------
// Top-line stats — 4 tiles with sparklines + 30d-vs-prior-30d deltas
// ---------------------------------------------------------------------------

function QaTilesRow({
  tiles,
  sparklines,
}: {
  tiles: TeamMemberQaTiles;
  sparklines: TeamMemberQaSparklines;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Total evals"
        value={formatNumber(tiles.totalEvals)}
        hint="All-time, excludes invalidated"
      />
      <StatCard
        label="Avg QA score (30d)"
        value={<TileValueWithSparkline value={formatScore(tiles.avgScore.current)} points={sparklines.score} />}
        delta={scoreDelta(tiles.avgScore.delta)}
      />
      <StatCard
        label="Avg CSAT (30d)"
        value={<TileValueWithSparkline value={formatCsat(tiles.avgCsat.current)} points={sparklines.csat} />}
        delta={csatDelta(tiles.avgCsat.delta)}
      />
      <StatCard
        label="AI-acceptance rate"
        value={
          tiles.aiAcceptance.pct == null ? "—" : formatPercent(tiles.aiAcceptance.pct)
        }
        hint={
          tiles.aiAcceptance.totalScores === 0
            ? "No scores yet"
            : `${formatNumber(tiles.aiAcceptance.overrides)} of ${formatNumber(tiles.aiAcceptance.totalScores)} overridden`
        }
      />
    </div>
  );
}

/** Sparkline rendered alongside the main tile number. Fixed-size (not
 *  ResponsiveContainer) — the parent StatCard's flex layout doesn't give
 *  Recharts a measured frame on first render, and the sparkline is
 *  intentionally small enough that a hard dimension is appropriate. */
function TileValueWithSparkline({
  value,
  points,
}: {
  value: string;
  points: SparklinePoint[];
}) {
  const hasData = points.some((p) => p.value != null);
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{value}</span>
      {hasData ? (
        <LineChart width={80} height={28} data={points}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      ) : null}
    </div>
  );
}

function formatScore(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatCsat(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)} / 5`;
}

function scoreDelta(delta: number | null): StatCardDelta | undefined {
  if (delta == null) return undefined;
  const sign = delta >= 0 ? "+" : "";
  return {
    label: `${sign}${delta.toFixed(1)}`,
    direction: deltaDirection(delta, 0.5),
    hint: "vs. prior 30 days",
  };
}

function csatDelta(delta: number | null): StatCardDelta | undefined {
  if (delta == null) return undefined;
  const sign = delta >= 0 ? "+" : "";
  return {
    label: `${sign}${delta.toFixed(2)} stars`,
    direction: deltaDirection(delta, 0.05),
    hint: "vs. prior 30 days",
  };
}

function deltaDirection(
  delta: number,
  neutralThreshold: number,
): StatCardDelta["direction"] {
  if (Math.abs(delta) < neutralThreshold) return "neutral";
  return delta > 0 ? "good" : "bad";
}

// ---------------------------------------------------------------------------
// Category breakdown — row-per-category bar with member, team, delta
// ---------------------------------------------------------------------------

function QaCategoryBreakdown({
  rows,
  evaluationCount,
  focusedCategoryId,
}: {
  rows: QaCategoryAverage[];
  evaluationCount: number;
  focusedCategoryId?: string | null;
}) {
  if (evaluationCount < MIN_EVALUATIONS_FOR_CATEGORIES) {
    return (
      <DashboardCard title="Category breakdown">
        <EmptyHint
          message={`Need at least ${MIN_EVALUATIONS_FOR_CATEGORIES} evaluations to compare category performance — there are ${evaluationCount}.`}
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Category breakdown">
      <ul className="space-y-3">
        {rows.map((row) => (
          <CategoryRow
            key={row.categoryId}
            row={row}
            highlighted={focusedCategoryId === row.categoryId}
          />
        ))}
      </ul>
    </DashboardCard>
  );
}

function CategoryRow({
  row,
  highlighted = false,
}: {
  row: QaCategoryAverage;
  highlighted?: boolean;
}) {
  const member = row.memberAvg;
  const team = row.teamAvg;
  const delta = member != null && team != null ? member - team : null;
  const deltaTone =
    delta == null || Math.abs(delta) < CATEGORY_DELTA_THRESHOLD
      ? "text-muted-foreground"
      : delta > 0
        ? "text-green-dark"
        : "text-red-dark";
  const deltaLabel =
    delta == null
      ? "—"
      : `${delta >= 0 ? "+" : ""}${delta.toFixed(0)} vs team`;

  return (
    <li
      className={
        highlighted
          ? "-mx-3 rounded-md bg-accent/50 px-3 py-1 ring-1 ring-border"
          : undefined
      }
    >
      <div className="mb-1 flex items-baseline justify-between gap-3 text-base">
        <span className="truncate text-foreground">{row.name}</span>
        <span className={`shrink-0 tabular-nums ${deltaTone}`}>{deltaLabel}</span>
      </div>
      <div className="relative h-2 rounded bg-muted">
        {team != null ? (
          <div
            className="absolute inset-y-0 w-px bg-muted-foreground"
            style={{ left: `${Math.min(100, Math.max(0, team))}%` }}
            aria-hidden
          />
        ) : null}
        {member != null ? (
          <div
            className="h-full rounded bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, member))}%` }}
          />
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
        <span>
          <span className="tabular-nums text-foreground">
            {member == null ? "—" : Math.round(member)}
          </span>{" "}
          this agent
        </span>
        <span>
          team avg{" "}
          <span className="tabular-nums text-foreground">
            {team == null ? "—" : Math.round(team)}
          </span>
        </span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Weekly trend — keep from SVP-69 (matches brief's intent for a trend chart)
// ---------------------------------------------------------------------------

function QaTrendChart({
  memberName,
  points,
  evaluationCount,
}: {
  memberName: string;
  points: QaWeeklyTrendPoint[];
  evaluationCount: number;
}) {
  const memberWeeksWithData = points.filter(
    (p) => p.memberAvg != null,
  ).length;

  if (memberWeeksWithData < MIN_WEEKS_FOR_TREND) {
    return (
      <DashboardCard title="Weekly score trend">
        <EmptyHint
          message={`Need at least ${MIN_WEEKS_FOR_TREND} weeks with evaluations to chart a trend. ${memberName} currently has data for ${memberWeeksWithData} week${memberWeeksWithData === 1 ? "" : "s"} out of ${evaluationCount} total evaluations.`}
        />
      </DashboardCard>
    );
  }

  const data = points.map((p) => ({
    weekStartMs: p.weekStartMs,
    label: formatTimelineDay(new Date(p.weekStartMs)),
    member: p.memberAvg == null ? null : Math.round(p.memberAvg),
    team: p.teamAvg == null ? null : Math.round(p.teamAvg),
  }));

  return (
    <DashboardCard title="Weekly score trend">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 4, left: -12 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={{ stroke: "var(--border)" }}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={20}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={{ stroke: "var(--border)" }}
              axisLine={{ stroke: "var(--border)" }}
            />
            <Tooltip
              content={<TrendTooltip memberName={memberName} />}
              cursor={{ stroke: "var(--border)" }}
            />
            <Line
              type="monotone"
              dataKey="team"
              name="Team average"
              stroke="var(--muted-foreground)"
              strokeOpacity={0.6}
              strokeDasharray="4 4"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="member"
              name={memberName}
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <LegendRow memberName={memberName} />
    </DashboardCard>
  );
}

function TrendTooltip({
  active,
  payload,
  memberName,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      label: string;
      member: number | null;
      team: number | null;
    };
  }>;
  memberName: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-base shadow-md">
      <div className="mb-1 font-medium text-popover-foreground">
        Week of {row.label}
      </div>
      <div className="space-y-0.5">
        <TooltipRow
          label={memberName}
          value={row.member}
          color="var(--primary)"
        />
        <TooltipRow
          label="Team average"
          value={row.team}
          color="var(--muted-foreground)"
        />
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: color }}
        />
        {label}
      </span>
      <span className="font-medium tabular-nums text-foreground">
        {value == null ? "—" : `${Math.round(value)}`}
      </span>
    </div>
  );
}

function LegendRow({ memberName }: { memberName: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <LegendDot color="var(--primary)" filled label={memberName} />
      <LegendDot
        color="var(--muted-foreground)"
        filled={false}
        label="Team average"
      />
    </div>
  );
}

function LegendDot({
  color,
  filled,
  label,
}: {
  color: string;
  filled: boolean;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-0.5 w-4"
        style={{
          background: filled ? color : "transparent",
          borderTop: filled ? "none" : `2px dashed ${color}`,
        }}
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Recent evaluations — EntityTable (row click → full coaching page)
// ---------------------------------------------------------------------------

function QaRecentEvaluationsTable({
  rows,
  totalCount,
  focusedCategoryId,
  focusedCategoryName,
}: {
  rows: QaRecentEvaluation[];
  totalCount: number;
  focusedCategoryId?: string | null;
  focusedCategoryName?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <DashboardCard title="Recent evaluations">
        <EmptyHint
          message={
            focusedCategoryId
              ? `No evaluations found for this category.`
              : "No evaluations yet."
          }
        />
      </DashboardCard>
    );
  }

  const trailingLabel = focusedCategoryId
    ? focusedCategoryName
      ? `Filtered to: ${focusedCategoryName}`
      : "Category filtered"
    : totalCount > rows.length
      ? `Showing ${rows.length} of ${formatNumber(totalCount)}`
      : null;

  return (
    <DashboardCard
      title="Recent evaluations"
      trailing={
        trailingLabel ? (
          <span className="text-base text-muted-foreground">{trailingLabel}</span>
        ) : null
      }
    >
      <ColumnStateProvider
        tableId="team-member-evaluations"
        properties={EVALUATION_PROPERTIES}
      >
        <EntityTable
          rows={rows}
          idField="id"
          properties={EVALUATION_PROPERTIES}
          page={1}
          pageSize={Math.max(rows.length, 1)}
          total={rows.length}
          serverSorted
          rowHref={(row) => `/evaluations/${row.id}`}
          emptyMessage="No evaluations yet."
        />
      </ColumnStateProvider>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Recent coaching notes — per-eval feed (latest strength + growth)
// ---------------------------------------------------------------------------

function QaCoachingFeed({ items }: { items: TeamMemberCoachingFeedItem[] }) {
  if (items.length === 0) {
    return (
      <DashboardCard title="Recent coaching notes">
        <EmptyHint message="No coaching notes generated yet. They'll appear here as evaluations are reviewed." />
      </DashboardCard>
    );
  }
  return (
    <DashboardCard
      title="Recent coaching notes"
      trailing={
        <Link
          href="/evaluations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Open evaluations
          <ArrowUpRight className="size-3.5" />
        </Link>
      }
    >
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.evaluationId}>
            <Link
              href={`/evaluations/${item.evaluationId}`}
              className="group/note -mx-1 block rounded-md px-1 py-2.5 transition-colors hover:bg-accent/40"
            >
              <div className="mb-1 flex items-center gap-2">
                <QaScoreBadge score={item.overallScore} status={item.status} />
                <span className="min-w-0 flex-1 truncate text-base text-foreground">
                  {item.ticketSubject}
                </span>
                <TimestampTooltip date={item.scoredAtMs}>
                  <span className="hidden text-base text-muted-foreground sm:inline">
                    {formatTimelineDay(new Date(item.scoredAtMs))}
                  </span>
                </TimestampTooltip>
                <ArrowUpRight className="size-3.5 text-muted-foreground opacity-60 group-hover/note:opacity-100" />
              </div>
              {item.strengthPoint ? (
                <div className="ml-1 flex items-start gap-1.5 text-base text-foreground">
                  <Check className="mt-1 size-3.5 shrink-0 text-green-dark" />
                  <span className="min-w-0 flex-1">{item.strengthPoint}</span>
                </div>
              ) : null}
              {item.growthPoint ? (
                <div className="ml-1 mt-0.5 flex items-start gap-1.5 text-base text-foreground">
                  <AlertTriangle className="mt-1 size-3.5 shrink-0 text-yellow-dark" />
                  <span className="min-w-0 flex-1">{item.growthPoint}</span>
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Strengths / growth — aggregate rollup (pattern view)
// ---------------------------------------------------------------------------

function QaStrengthsGrowth({
  strengths,
  growthAreas,
  coachingNoteCount,
}: {
  strengths: QaTopPoint[];
  growthAreas: QaTopPoint[];
  coachingNoteCount: number;
}) {
  if (coachingNoteCount < MIN_COACHING_FOR_TOPLISTS) {
    return (
      <DashboardCard title="Coaching highlights">
        <EmptyHint
          message={`Need at least ${MIN_COACHING_FOR_TOPLISTS} coaching notes to surface patterns — there are ${coachingNoteCount} so far.`}
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Coaching highlights">
      <div className="grid gap-6 sm:grid-cols-2">
        <TopPointColumn
          heading="What's going well"
          icon={<Check className="size-4 text-green-dark" />}
          points={strengths}
          emptyLabel="No recurring strengths called out yet."
        />
        <TopPointColumn
          heading="Where to focus next"
          icon={<AlertTriangle className="size-4 text-yellow-dark" />}
          points={growthAreas}
          emptyLabel="No recurring growth areas flagged yet."
        />
      </div>
    </DashboardCard>
  );
}

function TopPointColumn({
  heading,
  icon,
  points,
  emptyLabel,
}: {
  heading: string;
  icon: React.ReactNode;
  points: QaTopPoint[];
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-base font-medium">
        {icon}
        {heading}
      </div>
      {points.length === 0 ? (
        <div className="text-base text-muted-foreground">{emptyLabel}</div>
      ) : (
        <ul className="space-y-1.5">
          {points.map((p, idx) => (
            <li
              key={`${p.text}-${idx}`}
              className="flex items-start gap-2 text-base text-foreground"
            >
              <span className="mt-2 inline-block size-1 shrink-0 rounded-full bg-muted-foreground" />
              <span className="min-w-0 flex-1">
                {p.text}
                {p.count > 1 && (
                  <span className="ml-2 text-base text-muted-foreground">
                    · seen {p.count}×
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSAT correlation
// ---------------------------------------------------------------------------

function QaCsatCorrelation({
  rows,
  pairedResponseCount,
}: {
  rows: QaCsatCorrelationRow[];
  pairedResponseCount: number;
}) {
  if (pairedResponseCount < MIN_PAIRED_FOR_CSAT) {
    return (
      <DashboardCard title="Score ↔ CSAT correlation">
        <EmptyHint
          message={`Building this insight — need ${MIN_PAIRED_FOR_CSAT} paired evaluations + responses, you have ${pairedResponseCount}.`}
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Score ↔ CSAT correlation">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <CsatCorrelationCard key={row.categoryId} row={row} />
        ))}
      </div>
    </DashboardCard>
  );
}

function CsatCorrelationCard({ row }: { row: QaCsatCorrelationRow }) {
  if (row.highAvgRating == null || row.lowAvgRating == null) {
    return (
      <div className="rounded-md border border-border bg-background px-4 py-3 text-base text-muted-foreground">
        <div className="mb-1 font-medium text-foreground">{row.name}</div>
        Not enough variance to compare yet.
      </div>
    );
  }
  const delta = row.highAvgRating - row.lowAvgRating;
  return (
    <div className="rounded-md border border-border bg-background px-4 py-3">
      <div className="mb-2 font-medium text-foreground">{row.name}</div>
      <div className="space-y-1 text-base">
        <CsatRow
          label="High score (≥80)"
          rating={row.highAvgRating}
          sample={row.highSampleSize}
        />
        <CsatRow
          label="Low score (<80)"
          rating={row.lowAvgRating}
          sample={row.lowSampleSize}
        />
      </div>
      <div className="mt-2 text-base text-muted-foreground">
        {delta >= 0
          ? `+${delta.toFixed(1)} CSAT when scoring high.`
          : `${delta.toFixed(1)} CSAT when scoring high.`}
      </div>
    </div>
  );
}

function CsatRow({
  label,
  rating,
  sample,
}: {
  label: string;
  rating: number;
  sample: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">
        {rating.toFixed(1)}
        <span className="ml-1 text-base text-muted-foreground">
          / 5 · n={formatNumber(sample)}
        </span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category focus banner — shown when drilling in from the heatmap
// ---------------------------------------------------------------------------

function CategoryFocusBanner({ categoryName }: { categoryName: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-accent/30 px-4 py-2.5 text-base">
      <span className="flex-1 text-foreground">
        Showing evaluations for{" "}
        <span className="font-medium">{categoryName}</span>
      </span>
      <Link
        href="?"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
        Clear
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

function EmptyCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-base font-medium text-foreground">{title}</div>
        <p className="mt-1 text-base text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background px-4 py-6 text-center text-base text-muted-foreground">
      {message}
    </div>
  );
}
