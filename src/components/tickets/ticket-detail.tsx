"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Topbar } from "@/components/shell/topbar";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { recordEntityView } from "@/lib/recent-pages";
import { TICKET_PROPERTIES } from "@/lib/properties/tickets";
import { PropertiesPanel } from "@/components/shared/properties-panel";
import {
  DetailSection,
  PropertiesPanelHeader,
  PropertiesSidebar,
} from "@/components/shared/detail-section";
import { ResponsePill } from "@/components/shared/entity-pill";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { DetailActions } from "@/components/shared/detail-actions";
import { TicketActivitySection } from "@/components/tickets/ticket-activity";
import { TicketQaSection } from "@/components/qa/ticket-qa-section";
import { QaStatusPill } from "@/components/qa/qa-status-pill";
import type {
  QaCategoryView,
  QaEvaluationView,
  TicketDetail,
} from "@/db/queries/tickets";


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
      <PropertiesPanelHeader
        properties={TICKET_PROPERTIES}
        layout={inDrawer ? "inline" : "stacked"}
      />
      <PropertiesPanel
        row={ticket}
        properties={TICKET_PROPERTIES}
        rowEntity="Ticket"
        layout={inDrawer ? "inline" : "stacked"}
      />
    </>
  );

  // QA section split:
  //  - In the drawer: compact `QaBreakdownSection` from SVP-55, with a "View
  //    full QA" link that anchors at `/tickets/[id]#qa` on the standalone
  //    page (where the full SVP-54 surface lives).
  //  - On the standalone detail page: the full `TicketQaSection` wrapped in
  //    `<div id="qa">` so the drawer's link lands on it.
  // Both surfaces handle a null evaluation internally — gated here so the
  // section drops out entirely when a ticket has never been scored (the
  // "Score now" UX surfaces with SVP-58).
  const qaSection = ticket.evaluation ? (
    inDrawer ? (
      <QaBreakdownSection
        ticketId={ticket.id}
        evaluation={ticket.evaluation}
        inDrawer
      />
    ) : (
      <div id="qa">
        <TicketQaSection evaluation={ticket.evaluation} />
      </div>
    )
  ) : null;

  const content = (
    <>
      <TicketActivitySection
        messages={ticket.messages}
        events={ticket.events}
        highlightedMessageId={null}
      />

      {qaSection}

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
        <div className="mt-8 grid grid-cols-[1fr_auto] gap-10">
          <div className="min-w-0">{content}</div>
          <PropertiesSidebar>{properties}</PropertiesSidebar>
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

/** Compact QA breakdown surface for the drawer. SVP-55 introduced this;
 *  SVP-54 keeps the drawer compact and links out to the standalone full
 *  surface via the `#qa` anchor. */
function QaBreakdownSection({
  ticketId,
  evaluation,
  inDrawer,
}: {
  ticketId: string;
  evaluation: QaEvaluationView;
  inDrawer: boolean;
}) {
  return (
    <DetailSection title="QA breakdown">
      <div className="rounded-md border border-border bg-background">
        <div className="flex items-center gap-3 px-5 py-4">
          <QaScoreBadge
            score={evaluation.overallScore}
            status={evaluation.status}
            size="md"
          />
          <QaStatusPill status={evaluation.status} />
          {inDrawer && (
            <Link
              href={`/tickets/${ticketId}#qa`}
              className="ml-auto inline-flex items-center gap-1 text-base text-muted-foreground hover:text-foreground"
            >
              View full QA
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {evaluation.aiReasoningSummary && (
          <p className="border-t border-border px-5 py-3 text-base text-muted-foreground">
            {evaluation.aiReasoningSummary}
          </p>
        )}
        <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {evaluation.categories.map((c) => (
            <QaCategoryCard key={c.categoryId} category={c} />
          ))}
        </div>
      </div>
    </DetailSection>
  );
}

function QaCategoryCard({ category }: { category: QaCategoryView }) {
  const scoreLabel = formatCategoryScore(category);
  return (
    <div className="bg-background px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base font-medium text-foreground">
          {category.name}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {scoreLabel}
        </span>
      </div>
      {category.aiReasoning && (
        <p className="mt-1 line-clamp-2 text-base text-muted-foreground">
          {category.aiReasoning}
        </p>
      )}
    </div>
  );
}

function formatCategoryScore(c: QaCategoryView): string {
  if (c.scaleType === "binary") {
    return c.effectiveScore >= 1 ? "Pass" : "Fail";
  }
  if (c.scaleType === "three_state") {
    return `${c.effectiveScore} / 2`;
  }
  return `${c.effectiveScore} / 5`;
}
