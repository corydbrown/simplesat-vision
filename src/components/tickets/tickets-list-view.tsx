"use client";

import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ListFilterRow } from "@/components/shared/list-filter-row";
import { ListPageActions } from "@/components/shared/list-page-actions";
import { ViewBreadcrumb } from "@/components/shared/view-breadcrumb";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { TICKET_PROPERTIES } from "@/lib/properties/tickets";
import type { TicketsRow } from "@/db/queries/tickets";

/**
 * Persistent chrome for /tickets. Renders synchronously while the data
 * region (`children`) streams in behind a Suspense boundary on the page.
 * `allowedGroupIds` is passed in (rather than imported) because
 * `@/lib/group/fields/tickets` is `server-only`. See SVP-170.
 */
export function TicketsListShell({
  allowedGroupIds,
  children,
}: {
  allowedGroupIds: string[];
  children: React.ReactNode;
}) {
  return (
    <ColumnStateProvider
      tableId="tickets"
      properties={TICKET_PROPERTIES}
      entityKey="tickets"
    >
      <Topbar
        crumbs={[
          { label: "Tickets", href: "/tickets" },
          {
            label: "All tickets",
            node: <ViewBreadcrumb entityKey="tickets" />,
          },
        ]}
        actions={
          <ListPageActions entityKey="tickets" basePath="/tickets" />
        }
      />
      <EntityToolbar
        properties={TICKET_PROPERTIES}
        searchPlaceholder="Search tickets..."
        viewContext={{
          entityKey: "tickets",
          basePath: "/tickets",
          allowedGroupIds,
        }}
      />
      <ListFilterRow properties={TICKET_PROPERTIES} />
      {children}
    </ColumnStateProvider>
  );
}

export function TicketsTable({
  rows,
  total,
  page,
  pageSize,
  groupBy,
}: {
  rows: TicketsRow[];
  total: number;
  page: number;
  pageSize: number;
  groupBy?: string;
}) {
  return (
    <EntityTable
      rows={rows}
      idField="id"
      properties={TICKET_PROPERTIES}
      page={page}
      pageSize={pageSize}
      total={total}
      groupBy={groupBy}
      basePath="/tickets"
      drawerEntity="ticket"
      serverSorted
    />
  );
}
