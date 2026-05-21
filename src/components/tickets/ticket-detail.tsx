"use client";

import { useEffect } from "react";
import { Topbar } from "@/components/shell/topbar";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { recordEntityView } from "@/lib/recent-pages";
import { TICKET_PROPERTIES } from "@/lib/properties/tickets";
import { PropertiesPanel } from "@/components/shared/properties-panel";
import {
  DetailSection,
  PropertiesHeader,
} from "@/components/shared/detail-section";
import { ResponsePill } from "@/components/shared/entity-pill";
import { Badge } from "@/components/ui/badge";
import { DetailActions } from "@/components/shared/detail-actions";
import { TicketActivitySection } from "@/components/tickets/ticket-activity";
import type { TicketDetail } from "@/db/queries/tickets";

export function TicketDetailBody({
  ticket,
  inDrawer = false,
}: {
  ticket: TicketDetail;
  inDrawer?: boolean;
}) {
  useEffect(() => {
    // Drawer side records via global-drawer.tsx; standalone records here.
    if (inDrawer) return;
    recordEntityView({
      entity: "ticket",
      id: ticket.id,
      label: ticket.subject ?? `Ticket ${ticket.helpdeskExternalId ?? ticket.id}`,
      secondary: ticket.helpdeskExternalId
        ? `#${ticket.helpdeskExternalId}`
        : undefined,
    });
  }, [inDrawer, ticket.id, ticket.subject, ticket.helpdeskExternalId]);

  const header = (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {ticket.subject}
      </h1>
      {ticket.helpdeskExternalId && (
        <div className="mt-0.5 text-base text-muted-foreground">
          External ID: {ticket.helpdeskExternalId}
        </div>
      )}
    </div>
  );

  const properties = (
    <>
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-base font-medium text-muted-foreground">
          Properties
        </h2>
        <PropertiesHeader properties={TICKET_PROPERTIES} />
      </div>
      <PropertiesPanel
        row={ticket}
        properties={TICKET_PROPERTIES}
        layout={inDrawer ? "inline" : "stacked"}
      />
    </>
  );

  const content = (
    <>
      <TicketActivitySection
        messages={ticket.messages}
        events={ticket.events}
      />


      <DetailSection title="Survey response">
        {ticket.response ? (
          <div className="rounded-md border border-border bg-background px-5 py-4">
            <div className="flex items-center gap-3">
              <ResponsePill
                id={ticket.response.id}
                rating={ticket.response.rating}
                scale={ticket.response.scale}
                size="md"
              />
            </div>
            {ticket.response.comment && (
              <p className="mt-2 text-base text-muted-foreground">
                &ldquo;{ticket.response.comment}&rdquo;
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-5 py-4 text-base text-muted-foreground">
            {ticket.surveyNotSentReason
              ? `Survey not fired (reason: ${ticket.surveyNotSentReason.replace(/_/g, " ")})`
              : ticket.surveySentAt
                ? "Survey sent, no response yet"
                : "Not yet eligible"}
          </div>
        )}
      </DetailSection>

      <section className="mt-6 rounded-lg border border-dashed border-purple-light bg-purple-lighter/40 px-5 py-4">
        <div className="flex items-center gap-2 text-base font-medium text-purple-darker">
          QA Evaluation
          <Badge variant="secondary">Soon</Badge>
        </div>
        <p className="mt-1 text-base text-purple-darker/80">
          Independent quality scoring for this conversation. Rubric-based,
          model-graded, comparable across human and AI agents.
        </p>
      </section>
    </>
  );

  if (inDrawer) {
    return (
      <ColumnStateProvider tableId="ticket-detail" properties={TICKET_PROPERTIES}>
        <main className="px-10 py-7">
          {header}
          <div className="mt-6">{properties}</div>
          <div className="mt-6">{content}</div>
        </main>
      </ColumnStateProvider>
    );
  }

  return (
    <ColumnStateProvider tableId="ticket-detail" properties={TICKET_PROPERTIES}>
      <main className="px-14 py-10">
        {header}
        <div className="mt-8 grid grid-cols-[1fr_260px] gap-10">
          <div className="min-w-0">{content}</div>
          <aside className="sticky top-14 self-start">{properties}</aside>
        </div>
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
        actions={<DetailActions entityHref={`/tickets/${ticket.id}`} />}
      />
      <TicketDetailBody ticket={ticket} />
    </>
  );
}
