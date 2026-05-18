import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { CUSTOMER_PROPERTIES } from "@/lib/properties/customers";
import { listCustomers } from "@/db/queries/customers";
import { CUSTOMER_VIEWS } from "@/lib/views";

export default async function CustomersPage(props: PageProps<"/customers">) {
  const sp = await props.searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const { rows, total } = await listCustomers({ view });
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
      <EntityTable
        rows={rows}
        idField="id"
        properties={CUSTOMER_PROPERTIES}
        stickyId="name"
        page={1}
        pageSize={total || 1}
        total={total}
        basePath="/customers"
        rowHrefBase="/customers"
      />
    </ColumnStateProvider>
  );
}
