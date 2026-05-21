export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Star, TrendingDown } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Badge } from "@/components/ui/badge";
import {
  CompanyPill,
  CustomerPill,
  TeamMemberPill,
} from "@/components/shared/entity-pill";
import {
  getDecliningCustomers,
  getLowPerformingAgents,
  getSurveysNotFiredThisWeek,
} from "@/db/queries/insights";
import { formatNumber } from "@/lib/format";

const REASON_LABEL: Record<string, string> = {
  tag_excluded: "Tag excluded",
  suppression_list: "Suppression list",
  channel_disabled: "Channel disabled",
  automation_close: "Automation close",
};

function InsightCard({
  icon,
  title,
  subtitle,
  href,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <div>
            <div className="text-base font-semibold">{title}</div>
            {subtitle && (
              <div className="text-base text-muted-foreground">{subtitle}</div>
            )}
          </div>
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-base text-muted-foreground hover:text-foreground"
          >
            View all
            <ArrowRight size={12} />
          </Link>
        )}
      </header>
      <div className="px-5 py-3">{children}</div>
    </section>
  );
}

function RatingBadge({ value }: { value: number }) {
  const tone =
    value < 3
      ? "text-red-dark"
      : value < 4
        ? "text-yellow-dark"
        : "text-green-dark";
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${tone}`}>
      <Star size={12} className="fill-current" />
      <span className="tabular-nums font-medium">{value.toFixed(2)}</span>
    </span>
  );
}

export default async function HomePage() {
  const [declining, lowAgents, notFired] = await Promise.all([
    getDecliningCustomers(5),
    getLowPerformingAgents(5),
    getSurveysNotFiredThisWeek(),
  ]);

  return (
    <>
      <Topbar crumbs={[{ label: "Home" }]} />
      <main className="px-8 py-8 max-w-3xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good morning, Cory
          </h1>
          <p className="mt-1 text-muted-foreground">
            Three things worth a look this week.
          </p>
        </div>

        <InsightCard
          icon={<TrendingDown size={16} />}
          title="Customers trending down"
          subtitle="Lowest avg rating across at least 5 responses"
          href="/customers?view=at-risk"
        >
          <ul className="divide-y divide-border">
            {declining.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CustomerPill id={c.id} name={c.name} />
                  <span className="text-muted-foreground/50">·</span>
                  <CompanyPill name={c.company} />
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(c.responseCount)} responses
                  </span>
                  <RatingBadge value={c.avgRating} />
                </div>
              </li>
            ))}
          </ul>
        </InsightCard>

        <InsightCard
          icon={<TrendingDown size={16} />}
          title="Agents trending down"
          subtitle="Lowest avg rating across at least 20 responses"
          href="/team-members?view=low-performers"
        >
          <ul className="divide-y divide-border">
            {lowAgents.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TeamMemberPill
                    id={a.id}
                    name={a.name}
                    avatarColor={a.avatarColor}
                  />
                  <span className="text-xs text-muted-foreground">
                    {a.team}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(a.responseCount)} responses
                  </span>
                  <RatingBadge value={a.avgRating} />
                </div>
              </li>
            ))}
          </ul>
        </InsightCard>

        <InsightCard
          icon={<ShieldCheck size={16} />}
          title="Surveys not fired this week"
          subtitle="Tickets that didn't get a survey for a known reason"
          href="/tickets?view=not-fired"
        >
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-semibold tabular-nums">
              {formatNumber(notFired.total)}
            </span>
            <span className="text-base text-muted-foreground">total</span>
          </div>
          {notFired.byReason.length === 0 ? (
            <div className="text-base text-muted-foreground">
              Nothing this week.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {notFired.byReason
                .sort((a, b) => b.count - a.count)
                .map((r) => (
                  <li
                    key={r.reason}
                    className="flex items-center justify-between text-base"
                  >
                    <span className="text-muted-foreground">
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </span>
                    <span className="tabular-nums">
                      {formatNumber(r.count)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </InsightCard>

        <div className="rounded-lg border border-dashed border-purple-light bg-purple-lighter/40 px-5 py-4">
          <div className="flex items-center gap-2 text-base font-medium text-purple-darker">
            QA Evaluations
            <Badge variant="secondary">Soon</Badge>
          </div>
          <p className="mt-1 text-base text-purple-darker/80">
            Coming next: independent third-party scoring of every conversation -
            human or AI agent.
          </p>
        </div>
      </main>
    </>
  );
}
