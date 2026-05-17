import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { ChannelPill } from "@/components/tickets/channel-pill";
import { StatusPill } from "@/components/tickets/status-pill";
import {
  CustomerPill,
  ResponsePill,
  TicketPill,
} from "@/components/shared/entity-pill";
import {
  getRatingHistogram,
  getTeamMemberById,
  getTeamMemberTickets,
} from "@/db/queries/team-members";
import {
  formatDateTime,
  formatDuration,
  formatNumber,
} from "@/lib/format";
import { initialsFromName } from "@/lib/color-from-name";
import type { Channel, TicketStatus } from "@/db/schema";

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function RatingHistogram({
  data,
}: {
  data: { rating: number; count: number }[];
}) {
  const byRating = new Map(data.map((d) => [d.rating, d.count]));
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((r) => {
        const c = byRating.get(r) ?? 0;
        const pct = (c / max) * 100;
        const barTone =
          r >= 4
            ? "bg-emerald-400"
            : r === 3
              ? "bg-amber-400"
              : "bg-red-400";
        return (
          <div key={r} className="flex items-center gap-2 text-sm">
            <span className="flex w-6 items-center gap-0.5 tabular-nums text-muted-foreground">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              {r}
            </span>
            <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
              <div
                className={`h-full ${barTone}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-12 text-right tabular-nums text-muted-foreground">
              {formatNumber(c)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function TeamMemberDetailPage(
  props: PageProps<"/team-members/[id]">,
) {
  const { id } = await props.params;
  const member = await getTeamMemberById(id);
  if (!member) notFound();

  const [tickets, histogram] = await Promise.all([
    getTeamMemberTickets(id, 50),
    getRatingHistogram(id),
  ]);

  const avgRating = member.stats.avgRating;
  const avgTone =
    avgRating == null
      ? undefined
      : avgRating < 3.5
        ? "text-red-600"
        : avgRating < 4
          ? "text-amber-600"
          : "text-emerald-600";
  const isLowPerformer =
    avgRating != null &&
    avgRating < 3.5 &&
    member.stats.totalResponses >= 20;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Team members", href: "/team-members" },
          { label: member.name },
        ]}
      />
      <main className="px-8 py-8">
        <div className="mb-1 font-mono text-xs text-muted-foreground">
          {member.id}
        </div>
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-white"
            style={{ backgroundColor: member.avatarColor }}
          >
            {initialsFromName(member.name)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {member.name}
            </h1>
            <div className="text-muted-foreground">
              {member.role}
              <span className="mx-2 text-border">·</span>
              {member.team}
              <span className="mx-2 text-border">·</span>
              {member.email}
            </div>
          </div>
          {isLowPerformer && (
            <span className="ml-3 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
              Low performer
            </span>
          )}
        </div>

        <section className="mt-6 grid grid-cols-3 gap-3 max-w-2xl">
          <StatCard
            label="Tickets handled"
            value={formatNumber(member.stats.totalTickets)}
          />
          <StatCard
            label="Responses"
            value={formatNumber(member.stats.totalResponses)}
          />
          <StatCard
            label="Avg rating"
            tone={avgTone}
            value={
              avgRating != null ? (
                <span className="inline-flex items-baseline gap-1">
                  <Star size={16} className="fill-current self-center" />
                  {avgRating.toFixed(2)}
                </span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )
            }
          />
        </section>

        <section className="mt-8 max-w-2xl">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Rating distribution
          </h2>
          <div className="mt-3 rounded-md border border-border bg-background px-5 py-4">
            <RatingHistogram data={histogram} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent tickets
          </h2>
          <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Subject", "Status", "Channel", "Customer", "Resolution", "Rating", "Created"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-medium text-xs text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-sm text-muted-foreground"
                    >
                      No tickets yet.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border last:border-b-0 hover:bg-accent/40"
                    >
                      <td className="px-3 py-1.5">
                        <TicketPill id={t.id} />
                      </td>
                      <td className="px-3 py-1.5">{t.subject}</td>
                      <td className="px-3 py-1.5">
                        <StatusPill status={t.status as TicketStatus} />
                      </td>
                      <td className="px-3 py-1.5">
                        <ChannelPill channel={t.channel as Channel} />
                      </td>
                      <td className="px-3 py-1.5">
                        {t.customerId && t.customerName ? (
                          <CustomerPill id={t.customerId} name={t.customerName} />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                        {formatDuration(t.createdAt, t.solvedAt)}
                      </td>
                      <td className="px-3 py-1.5">
                        {t.rating != null && t.scale != null ? (
                          <ResponsePill rating={t.rating} scale={t.scale} />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                        {formatDateTime(t.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
