"use client";

import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ListFilterRow } from "@/components/shared/list-filter-row";
import { ListPageActions } from "@/components/shared/list-page-actions";
import { ViewBreadcrumb } from "@/components/shared/view-breadcrumb";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { useCustomerProperties } from "@/lib/properties/custom-fields-context";
import type { CustomerListRow } from "@/db/queries/customers";

/**
 * Renders the persistent chrome (Topbar / Toolbar / FilterRow) and a slot
 * for the data region. The data region is supplied via `children` so the
 * server page can wrap it in `<Suspense>` while the shell paints
 * synchronously — that's what makes the page chrome anchor instantly while
 * the table skeleton fills its own region. See SVP-170.
 */
export function CustomersListShell({
  allowedGroupIds,
  children,
}: {
  allowedGroupIds: string[];
  children: React.ReactNode;
}) {
  const properties = useCustomerProperties();

  return (
    <ColumnStateProvider
      tableId="customers"
      properties={properties}
      entityKey="customers"
    >
      <Topbar
        crumbs={[
          { label: "Customers", href: "/customers" },
          {
            label: "All customers",
            node: <ViewBreadcrumb entityKey="customers" />,
          },
        ]}
        actions={
          <ListPageActions entityKey="customers" basePath="/customers" />
        }
      />
      <EntityToolbar
        properties={properties}
        searchPlaceholder="Search customers..."
        viewContext={{
          entityKey: "customers",
          basePath: "/customers",
          allowedGroupIds,
        }}
      />
      <ListFilterRow properties={properties} />
      {children}
    </ColumnStateProvider>
  );
}

export function CustomersTable({
  rows,
  total,
  groupBy,
}: {
  rows: CustomerListRow[];
  total: number;
  groupBy?: string;
}) {
  const properties = useCustomerProperties();

  return (
    <EntityTable
      rows={rows}
      idField="id"
      properties={properties}
      page={1}
      pageSize={total || 1}
      total={total}
      groupBy={groupBy}
      basePath="/customers"
      drawerEntity="customer"
      serverSorted
    />
  );
}
