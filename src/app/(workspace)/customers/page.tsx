import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ListFilterRow } from "@/components/shared/list-filter-row";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { filtersFromSearchParam } from "@/lib/filters/url-state";
import { CUSTOMER_GROUP_IDS } from "@/lib/group/fields/customers";
import { groupFromSearchParam } from "@/lib/group/url-state";
import { CUSTOMER_PROPERTIES } from "@/lib/properties/customers";
import { parseSortParam } from "@/lib/sort/url-state";
import { listCustomers } from "@/db/queries/customers";
import { CUSTOMER_VIEWS } from "@/lib/views";

export default async function CustomersPage(props: PageProps<"/customers">) {
  const sp = await props.searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const sorts = parseSortParam(typeof sp.sort === "string" ? sp.sort : undefined);
  const groupBy = groupFromSearchParam(sp.group, CUSTOMER_GROUP_IDS);
  const filters = filtersFromSearchParam(sp.f);
  const { rows, total } = await listCustomers({ view, sorts, groupBy, filters });
  const activeView = CUSTOMER_VIEWS.find((v) => v.id === (view ?? "all"));

  return (
    <ColumnStateProvider tableId="customers" properties={CUSTOMER_PROPERTIES}>
      <Topbar
        crumbs={[
          { label: "Customers", href: "/customers" },
          { label: activeView?.label ?? "All customers" },
        ]}
      />
      <EntityToolbar
        properties={CUSTOMER_PROPERTIES}
        searchPlaceholder="Search customers..."
      />
      <ListFilterRow properties={CUSTOMER_PROPERTIES} />
      <EntityTable
        rows={rows}
        idField="id"
        properties={CUSTOMER_PROPERTIES}
        page={1}
        pageSize={total || 1}
        total={total}
        groupBy={groupBy?.propertyId}
        basePath="/customers"
        drawerEntity="customer"
        serverSorted
      />
    </ColumnStateProvider>
  );
}
