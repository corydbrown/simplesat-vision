import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { ChannelPill } from "@/components/tickets/channel-pill";
import { StatusPill } from "@/components/tickets/status-pill";
import {
  CompanyPill,
  ResponsePill,
  TeamMemberPill,
  TicketPill,
} from "@/components/shared/entity-pill";
import {
  getCustomerById,
  getCustomerTickets,
} from "@/db/queries/customers";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
} from "@/lib/format";
import type { TicketStatus, Channel } from "@/db/schema";

const TIER_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

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

export default async function CustomerDetailPage(
  props: PageProps<"/customers/[id]">,
) {
  const { id } = await props.params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const tickets = await getCustomerTickets(id, 50);
  const avgRating = customer.stats.avgRating;
  const avgTone =
    avgRating == null
      ? undefined
      : avgRating < 3
        ? "text-red-600"
        : avgRating < 4
          ? "text-amber-600"
          : "text-emerald-600";

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Customers", href: "/customers" },
          { label: customer.name },
        ]}
      />
      <main className="px-8 py-8">
        <div className="mb-1 font-mono text-xs text-muted-foreground">
          {customer.id}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {customer.name}
        </h1>
        <div className="mt-2 text-muted-foreground">
          {customer.email}
          <span className="mx-2 text-border">·</span>
          <CompanyPill name={customer.company} size="md" />
          <span className="mx-2 text-border">·</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {TIER_LABEL[customer.tier]}
          </span>
        </div>

        <section className="mt-6 grid grid-cols-4 gap-3 max-w-3xl">
          <StatCard
            label="Tickets"
            value={formatNumber(customer.stats.totalTickets)}
          />
          <StatCard
            label="Responses"
            value={formatNumber(customer.stats.totalResponses)}
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
          <StatCard
            label="Last seen"
            value={
              <span className="text-base font-normal text-foreground">
                {formatDate(customer.stats.lastSeen)}
              </span>
            }
          />
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent tickets
          </h2>
          <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Subject", "Status", "Channel", "Assignee", "Resolution", "Rating", "Created"].map((h) => (
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
                    <tr key={t.id} className="border-b border-border last:border-b-0 hover:bg-accent/40">
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
                        {t.assigneeId && t.assigneeName && t.assigneeAvatarColor ? (
                          <TeamMemberPill
                            id={t.assigneeId}
                            name={t.assigneeName}
                            avatarColor={t.assigneeAvatarColor}
                          />
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
