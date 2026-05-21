"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { CUSTOMER_PROPERTIES } from "@/lib/properties/customers";
import { TICKET_PROPERTIES } from "@/lib/properties/tickets";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import { PropertiesPanel } from "@/components/shared/properties-panel";
import { PropertiesHeader } from "@/components/shared/detail-section";
import { EntityTable } from "@/components/shared/entity-table";
import { RelationTabs } from "@/components/shared/relation-tabs";
import { OpenInTable } from "@/components/shared/open-in-table";
import { Avatar } from "@/components/shared/avatar";
import { colorFromName, initialsFromName } from "@/lib/color-from-name";
import { recordEntityView } from "@/lib/recent-pages";
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
  inDrawer = false,
}: {
  customer: CustomerDetail;
  customerRow: CustomerListRow;
  tickets: TicketsRow[];
  responses: ResponseListRow[];
  inDrawer?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramName = inDrawer ? "dt" : "tab";
  const rawTab = searchParams.get(paramName);
  const tab: "tickets" | "responses" =
    rawTab === "responses" ? "responses" : "tickets";

  useEffect(() => {
    if (!inDrawer || rawTab) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("dt", "tickets");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [inDrawer, rawTab, pathname, router, searchParams]);

  useEffect(() => {
    // Drawer side records via global-drawer.tsx; standalone records here.
    if (inDrawer) return;
    recordEntityView({
      entity: "customer",
      id: customer.id,
      label: customer.name,
      secondary: customer.company ?? customer.email ?? undefined,
    });
  }, [
    inDrawer,
    customer.id,
    customer.name,
    customer.company,
    customer.email,
  ]);

  const header = (
    <div className="flex items-center gap-3">
      <Avatar
        bg={colorFromName(customer.name)}
        initials={initialsFromName(customer.name)}
        size="xl"
      />
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight truncate">
          {customer.name}
        </h1>
        <div className="mt-0.5 text-base text-muted-foreground truncate">
          {customer.company ? (
            <>
              {customer.company}
              <span className="mx-2 text-border">·</span>
            </>
          ) : null}
          {customer.email}
        </div>
      </div>
    </div>
  );

  const properties = (
    <ColumnStateProvider
      tableId="customer-detail"
      properties={CUSTOMER_PROPERTIES}
    >
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-base font-medium text-muted-foreground">
          Properties
        </h2>
        <PropertiesHeader properties={CUSTOMER_PROPERTIES} />
      </div>
      <PropertiesPanel
        row={customerRow}
        properties={CUSTOMER_PROPERTIES}
        layout={inDrawer ? "inline" : "stacked"}
      />
    </ColumnStateProvider>
  );

  const tabsAndTable = (
    <>
      <RelationTabs
        paramName={paramName}
        alwaysSet={inDrawer}
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
        trailing={
          <OpenInTable
            href={tab === "tickets" ? "/tickets" : "/responses"}
            label={`Open ${tab} as full table`}
          />
        }
      />
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
            drawerEntity="ticket"
            paramPrefix={inDrawer ? "d" : ""}
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
            drawerEntity="response"
            paramPrefix={inDrawer ? "d" : ""}
            emptyMessage="No responses yet."
          />
        </ColumnStateProvider>
      )}
    </>
  );

  if (inDrawer) {
    return (
      <main className="px-10 py-7">
        {header}
        <div className="mt-6">{properties}</div>
        <div className="mt-6">{tabsAndTable}</div>
      </main>
    );
  }

  return (
    <main className="px-14 py-10">
      {header}
      <div className="mt-8 grid grid-cols-[1fr_260px] gap-10">
        <div className="min-w-0">{tabsAndTable}</div>
        <aside className="sticky top-14 self-start">{properties}</aside>
      </div>
    </main>
  );
}
