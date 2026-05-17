import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { ChannelPill } from "@/components/tickets/channel-pill";
import { StatusPill } from "@/components/tickets/status-pill";
import {
  CompanyPill,
  CustomerPill,
  ResponsePill,
  TeamMemberPill,
} from "@/components/shared/entity-pill";
import { getTicketById } from "@/db/queries/tickets";
import { formatDateTime, formatDuration } from "@/lib/format";

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-4 py-1.5 text-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default async function TicketDetailPage(
  props: PageProps<"/tickets/[id]">,
) {
  const { id } = await props.params;
  const ticket = await getTicketById(id);
  if (!ticket) notFound();

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Tickets", href: "/tickets" },
          { label: ticket.id },
        ]}
      />
      <main className="px-8 py-8 max-w-4xl">
        <div className="mb-1 font-mono text-xs text-muted-foreground">
          {ticket.id}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {ticket.subject}
        </h1>

        <div className="mt-6 divide-y divide-border rounded-md border border-border bg-background">
          <div className="px-5 py-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Properties
            </h2>
          </div>
          <div className="px-5 py-2">
            <PropertyRow label="Status">
              <StatusPill status={ticket.status} />
            </PropertyRow>
            <PropertyRow label="Customer">
              {ticket.customer ? (
                <CustomerPill
                  id={ticket.customer.id}
                  name={ticket.customer.name}
                  size="md"
                />
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </PropertyRow>
            <PropertyRow label="Company">
              {ticket.customer?.company ? (
                <CompanyPill name={ticket.customer.company} size="md" />
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </PropertyRow>
            <PropertyRow label="Assigned to">
              {ticket.assignee ? (
                <TeamMemberPill
                  id={ticket.assignee.id}
                  name={ticket.assignee.name}
                  avatarColor={ticket.assignee.avatarColor}
                  size="md"
                />
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </PropertyRow>
            <PropertyRow label="Channel">
              <ChannelPill channel={ticket.channel} />
            </PropertyRow>
            <PropertyRow label="Helpdesk">
              <span className="text-sm capitalize">{ticket.helpdesk}</span>
            </PropertyRow>
            <PropertyRow label="Created">
              <span className="text-sm tabular-nums">
                {formatDateTime(ticket.createdAt)}
              </span>
            </PropertyRow>
            <PropertyRow label="First response">
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatDateTime(ticket.firstResponseAt)}
              </span>
            </PropertyRow>
            <PropertyRow label="Solved">
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatDateTime(ticket.solvedAt)}
              </span>
            </PropertyRow>
            <PropertyRow label="Closed">
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatDateTime(ticket.closedAt)}
              </span>
            </PropertyRow>
            <PropertyRow label="Resolution time">
              <span className="text-sm tabular-nums">
                {formatDuration(ticket.createdAt, ticket.solvedAt)}
              </span>
            </PropertyRow>
            <PropertyRow label="Tags">
              <div className="flex flex-wrap gap-1">
                {ticket.tags.length === 0 ? (
                  <span className="text-sm text-muted-foreground">-</span>
                ) : (
                  ticket.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))
                )}
              </div>
            </PropertyRow>
          </div>
        </div>

        {ticket.conversation.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Conversation
            </h2>
            <div className="mt-3 space-y-3">
              {ticket.conversation.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-md border border-border px-4 py-3 ${
                    m.role === "agent" ? "bg-muted/40" : "bg-background"
                  }`}
                >
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium">
                      {m.author}
                      <span className="ml-1.5 text-muted-foreground capitalize">
                        ({m.role})
                      </span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatDateTime(new Date(m.time))}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm text-foreground">{m.body}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Survey response
          </h2>
          {ticket.response ? (
            <div className="mt-3 rounded-md border border-border bg-background px-5 py-4">
              <div className="flex items-center gap-3">
                <ResponsePill
                  rating={ticket.response.rating}
                  scale={ticket.response.scale}
                  size="md"
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {ticket.response.id}
                </span>
              </div>
              {ticket.response.comment && (
                <p className="mt-2 text-sm text-muted-foreground">
                  &ldquo;{ticket.response.comment}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-dashed border-border bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
              {ticket.surveyNotSentReason
                ? `Survey not fired (reason: ${ticket.surveyNotSentReason.replace(/_/g, " ")})`
                : ticket.surveySentAt
                  ? "Survey sent, no response yet"
                  : "Not yet eligible"}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-dashed border-purple-300 bg-purple-50/40 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-purple-900">
            QA Evaluation
            <span className="rounded bg-purple-200/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-purple-900">
              Soon
            </span>
          </div>
          <p className="mt-1 text-sm text-purple-900/80">
            Independent quality scoring for this conversation. Rubric-based,
            model-graded, comparable across human and AI agents.
          </p>
        </section>
      </main>
    </>
  );
}
