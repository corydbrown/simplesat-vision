import { Topbar } from "@/components/shell/topbar";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { TICKET_PROPERTIES } from "@/lib/properties/tickets";
import { PropertiesPanel } from "@/components/shared/properties-panel";
import {
  DetailSection,
  PropertiesHeader,
} from "@/components/shared/detail-section";
import { ResponsePill } from "@/components/shared/entity-pill";
import type { TicketDetail } from "@/db/queries/tickets";
import { formatDateTime } from "@/lib/format";

export function TicketDetailBody({ ticket }: { ticket: TicketDetail }) {
  return (
    <ColumnStateProvider
      tableId="ticket-detail"
      properties={TICKET_PROPERTIES}
    >
      <main className="px-8 py-6">
        <div className="mb-1 font-mono text-xs text-muted-foreground">
          {ticket.helpdeskExternalId ?? ticket.id}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {ticket.subject}
        </h1>

        <DetailSection
          title="Properties"
          trailing={<PropertiesHeader properties={TICKET_PROPERTIES} />}
        >
          <PropertiesPanel row={ticket} properties={TICKET_PROPERTIES} />
        </DetailSection>

        {ticket.conversation.length > 0 && (
          <DetailSection title="Conversation">
            <div className="space-y-3">
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
          </DetailSection>
        )}

        <DetailSection title="Survey response">
          {ticket.response ? (
            <div className="rounded-md border border-border bg-background px-5 py-4">
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
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
              {ticket.surveyNotSentReason
                ? `Survey not fired (reason: ${ticket.surveyNotSentReason.replace(/_/g, " ")})`
                : ticket.surveySentAt
                  ? "Survey sent, no response yet"
                  : "Not yet eligible"}
            </div>
          )}
        </DetailSection>

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
    </ColumnStateProvider>
  );
}

export function TicketDetailPage({ ticket }: { ticket: TicketDetail }) {
  return (
    <>
      <Topbar
        crumbs={[
          { label: "Tickets", href: "/tickets" },
          { label: ticket.helpdeskExternalId ?? ticket.id },
        ]}
      />
      <TicketDetailBody ticket={ticket} />
    </>
  );
}
