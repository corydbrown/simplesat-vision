"use client";

import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ListFilterRow } from "@/components/shared/list-filter-row";
import { ListPageActions } from "@/components/shared/list-page-actions";
import { ViewBreadcrumb } from "@/components/shared/view-breadcrumb";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { CUSTOMER_GROUP_IDS } from "@/lib/group/fields/customers";
import { useCustomerProperties } from "@/lib/properties/custom-fields-context";
import type { CustomerListRow } from "@/db/queries/customers";

/**
 * Client view for the customers list. Properties come from
 * `useCustomerProperties()` so the column set (and the tier column) follow the
 * active workspace — the parent server page just fetches the rows. Splitting
 * the view out is what lets a server-derived, workspace-scoped property list
 * reach the client EntityTable without serializing render closures.
 */
export function CustomersListView({
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
          allowedGroupIds: CUSTOMER_GROUP_IDS,
        }}
      />
      <ListFilterRow properties={properties} />
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
    </ColumnStateProvider>
  );
}
