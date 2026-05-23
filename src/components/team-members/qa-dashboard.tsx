"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check } from "lucide-react";
import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { DetailSection } from "@/components/shared/detail-section";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { formatNumber, formatTimelineDay } from "@/lib/format";
import type {
  QaCategoryAverage,
  QaCsatCorrelationRow,
  QaRecentEvaluation,
  QaTopPoint,
  QaWeeklyTrendPoint,
  TeamMemberQaRollup,
} from "@/db/queries/team-members";

const MIN_EVALUATIONS_FOR_RADAR = 3;
const MIN_WEEKS_FOR_TREND = 2;
const MIN_COACHING_FOR_TOPLISTS = 3;
const MIN_PAIRED_FOR_CSAT = 20;

type Props = {
  memberName: string;
  rollup: TeamMemberQaRollup;
};

export function QaDashboard({ memberName, rollup }: Props) {
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

  if (evaluationCount === 0) {
    return (
      <DetailSection title="QA performance">
        <EmptyCard
          title="No evaluations yet"
          description={`${memberName} hasn't been scored on any tickets yet. Coaching insights, category averages, and trend will populate once evaluations roll in.`}
        />
      </DetailSection>
    );
  }

  return (
    <DetailSection title="QA performance">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QaRadar
          memberName={memberName}
          rows={categoryAverages}
          evaluationCount={evaluationCount}
        />
        <QaTrendChart
          memberName={memberName}
          points={weeklyTrend}
          evaluationCount={evaluationCount}
        />
      </div>

      <div className="mt-4">
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

      <div className="mt-4">
        <QaRecentEvaluations
          rows={recentEvaluations}
          totalCount={evaluationCount}
        />
      </div>
    </DetailSection>
  );
}

// ---------------------------------------------------------------------------
// Radar — per-category averages, member vs team overlay
// ---------------------------------------------------------------------------

function QaRadar({
  memberName,
  rows,
  evaluationCount,
}: {
  memberName: string;
  rows: QaCategoryAverage[];
  evaluationCount: number;
}) {
  if (evaluationCount < MIN_EVALUATIONS_FOR_RADAR) {
    return (
      <DashboardCard title="Category breakdown">
        <EmptyHint
          message={`Need at least ${MIN_EVALUATIONS_FOR_RADAR} evaluations to chart category strengths — ${memberName} has ${evaluationCount}.`}
        />
      </DashboardCard>
    );
  }

  const data = rows.map((r) => ({
    name: r.name,
    member: r.memberAvg == null ? 0 : Math.round(r.memberAvg),
    team: r.teamAvg == null ? 0 : Math.round(r.teamAvg),
    memberRaw: r.memberAvg,
    teamRaw: r.teamAvg,
  }));

  return (
    <DashboardCard title="Category breakdown">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="78%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="name"
              tick={{
                fill: "var(--muted-foreground)",
                fontSize: 12,
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
              stroke="var(--border)"
            />
            <Radar
              name="Team average"
              dataKey="team"
              stroke="var(--muted-foreground)"
              fill="var(--muted-foreground)"
              fillOpacity={0.1}
              strokeOpacity={0.6}
              strokeDasharray="4 4"
            />
            <Radar
              name={memberName}
              dataKey="member"
              stroke="var(--primary)"
              fill="var(--primary)"
              fillOpacity={0.25}
            />
            <Tooltip
              content={<RadarTooltip memberName={memberName} />}
              cursor={{ stroke: "var(--border)" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <LegendRow memberName={memberName} />
    </DashboardCard>
  );
}

function RadarTooltip({
  active,
  payload,
  memberName,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      memberRaw: number | null;
      teamRaw: number | null;
    };
  }>;
  memberName: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-base shadow-md">
      <div className="mb-1 font-medium text-popover-foreground">{row.name}</div>
      <div className="space-y-0.5">
        <TooltipRow
          label={memberName}
          value={row.memberRaw}
          color="var(--primary)"
        />
        <TooltipRow
          label="Team average"
          value={row.teamRaw}
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
// Weekly trend chart — member vs team
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
      <div className="h-72">
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

// ---------------------------------------------------------------------------
// Strengths / growth
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
// Recent evaluations list
// ---------------------------------------------------------------------------

function QaRecentEvaluations({
  rows,
  totalCount,
}: {
  rows: QaRecentEvaluation[];
  totalCount: number;
}) {
  if (rows.length === 0) {
    return (
      <DashboardCard title="Recent evaluations">
        <EmptyHint message="No evaluations yet." />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Recent evaluations"
      trailing={
        totalCount > rows.length ? (
          <span className="text-base text-muted-foreground">
            Showing {rows.length} of {formatNumber(totalCount)}
          </span>
        ) : null
      }
    >
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/tickets/${row.ticketId}#qa`}
              className="group/row -mx-1 flex items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-accent/40"
            >
              <QaScoreBadge score={row.overallScore} status={row.status} />
              <span className="min-w-0 flex-1 truncate text-base text-foreground">
                {row.ticketSubject}
              </span>
              <span className="hidden text-base text-muted-foreground sm:inline">
                {formatTimelineDay(new Date(row.scoredAtMs))}
              </span>
              <ArrowUpRight className="size-3.5 text-muted-foreground opacity-60 group-hover/row:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

function DashboardCard({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-medium text-foreground">{title}</h3>
          {trailing}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

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
