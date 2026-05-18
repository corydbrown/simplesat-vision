import { ColumnStateProvider } from "@/lib/column-prefs";
import { CUSTOMER_PROPERTIES } from "@/lib/properties/customers";
import { TICKET_PROPERTIES } from "@/lib/properties/tickets";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import { PropertiesPanel } from "@/components/shared/properties-panel";
import {
  DetailSection,
  PropertiesHeader,
} from "@/components/shared/detail-section";
import { EntityTable } from "@/components/shared/entity-table";
import { RelationTabs } from "@/components/shared/relation-tabs";
import type {
  CustomerDetail,
  CustomerListRow,
} from "@/db/queries/customers";
import type { TicketsRow } from "@/db/queries/tickets";
import type { ResponseListRow } from "@/db/queries/responses";

export function CustomerDetailBody({
  customer,
  customerRow,
  tickets,
  responses,
  tab,
}: {
  customer: CustomerDetail;
  customerRow: CustomerListRow;
  tickets: TicketsRow[];
  responses: ResponseListRow[];
  tab: "tickets" | "responses";
}) {
  return (
    <main className="px-8 py-6">
      <div className="mb-1 font-mono text-xs text-muted-foreground">
        {customer.id}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {customer.name}
      </h1>

      <ColumnStateProvider
        tableId="customer-detail"
        properties={CUSTOMER_PROPERTIES}
      >
        <DetailSection
          title="Properties"
          trailing={<PropertiesHeader properties={CUSTOMER_PROPERTIES} />}
        >
          <PropertiesPanel row={customerRow} properties={CUSTOMER_PROPERTIES} />
        </DetailSection>
      </ColumnStateProvider>

      <section className="mt-6">
        <RelationTabs
          tabs={[
            {
              id: "tickets",
              label: "Tickets",
              count: customer.stats.totalTickets,
            },
            {
              id: "responses",
              label: "Responses",
              count: customer.stats.totalResponses,
            },
          ]}
        />

        <div className="border border-t-0 border-border bg-background">
          {tab === "tickets" ? (
            <ColumnStateProvider
              tableId="customer-tickets"
              properties={TICKET_PROPERTIES}
            >
              <EntityTable
                rows={tickets}
                idField="id"
                properties={TICKET_PROPERTIES}
                page={1}
                pageSize={Math.max(tickets.length, 1)}
                total={tickets.length}
                basePath={`/customers/${customer.id}`}
                rowHrefBase="/tickets"
                emptyMessage="No tickets yet."
              />
            </ColumnStateProvider>
          ) : (
            <ColumnStateProvider
              tableId="customer-responses"
              properties={RESPONSE_PROPERTIES}
            >
              <EntityTable
                rows={responses}
                idField="id"
                properties={RESPONSE_PROPERTIES}
                page={1}
                pageSize={Math.max(responses.length, 1)}
                total={responses.length}
                basePath={`/customers/${customer.id}`}
                rowHrefBase="/responses"
                emptyMessage="No responses yet."
              />
            </ColumnStateProvider>
          )}
        </div>
      </section>
    </main>
  );
}
