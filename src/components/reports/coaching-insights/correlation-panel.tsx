"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardCard } from "@/components/shared/dashboard-card";
import type { CorrelationBucket } from "@/db/queries/coaching-insights";

const BUCKET_COLORS: Record<CorrelationBucket["bucket"], string> = {
  "0-50": "var(--color-red)",
  "50-70": "var(--color-yellow)",
  "70-85": "var(--color-green)",
  "85-100": "var(--color-green-dark)",
};

const BUCKET_LABEL: Record<CorrelationBucket["bucket"], string> = {
  "0-50": "0-50",
  "50-70": "50-70",
  "70-85": "70-85",
  "85-100": "85-100",
};

export function CoachingCorrelationPanel({
  buckets,
}: {
  buckets: CorrelationBucket[];
}) {
  const data = buckets.map((b) => ({
    bucket: BUCKET_LABEL[b.bucket],
    avgCsat: b.avgCsat == null ? null : Number(b.avgCsat.toFixed(2)),
    ticketCount: b.ticketCount,
    rawBucket: b.bucket,
  }));

  const lowBucket = buckets.find((b) => b.bucket === "0-50");
  const topBucket = buckets.find((b) => b.bucket === "85-100");
  const headline =
    lowBucket && topBucket && lowBucket.avgCsat != null && topBucket.avgCsat != null
      ? `Tickets scoring above 85 average ${topBucket.avgCsat.toFixed(
          1,
        )} CSAT vs. ${lowBucket.avgCsat.toFixed(1)} for tickets below 50.`
      : "Not enough paired QA × CSAT data yet to draw a correlation.";

  const hasAnyData = data.some((d) => d.avgCsat != null);

  return (
    <DashboardCard title="CSAT × QA score">
      <p className="mb-3 text-base text-muted-foreground">{headline}</p>
      <div className="h-64">
        {hasAnyData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 12, right: 12, bottom: 4, left: -12 }}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickLine={{ stroke: "var(--border)" }}
                axisLine={{ stroke: "var(--border)" }}
                label={{
                  value: "QA score",
                  position: "insideBottom",
                  offset: -2,
                  fill: "var(--muted-foreground)",
                  fontSize: 12,
                }}
              />
              <YAxis
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickLine={{ stroke: "var(--border)" }}
                axisLine={{ stroke: "var(--border)" }}
                label={{
                  value: "Avg CSAT",
                  angle: -90,
                  position: "insideLeft",
                  offset: 18,
                  fill: "var(--muted-foreground)",
                  fontSize: 12,
                }}
              />
              <Tooltip content={<CorrelationTooltip />} cursor={false} />
              <Bar dataKey="avgCsat" radius={[4, 4, 0, 0]}>
                {data.map((d) => (
                  <Cell
                    key={d.rawBucket}
                    fill={BUCKET_COLORS[d.rawBucket]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-base text-muted-foreground">
            No paired evaluations + CSAT responses yet.
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

function CorrelationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      bucket: string;
      avgCsat: number | null;
      ticketCount: number;
    };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const { bucket, avgCsat, ticketCount } = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-md">
      <div className="font-medium text-foreground">QA score {bucket}</div>
      <div className="text-muted-foreground">
        Avg CSAT:{" "}
        <span className="text-foreground tabular-nums">
          {avgCsat == null ? "—" : avgCsat.toFixed(2)}
        </span>
      </div>
      <div className="text-muted-foreground">
        Tickets:{" "}
        <span className="text-foreground tabular-nums">{ticketCount}</span>
      </div>
    </div>
  );
}
