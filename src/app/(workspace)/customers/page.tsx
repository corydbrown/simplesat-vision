import { CustomersListView } from "@/components/customers/customers-list-view";
import { filtersFromSearchParam } from "@/lib/filters/url-state";
import { CUSTOMER_GROUP_IDS } from "@/lib/group/fields/customers";
import { groupFromSearchParam } from "@/lib/group/url-state";
import { parseSortParam } from "@/lib/sort/url-state";
import { listCustomers } from "@/db/queries/customers";

export default async function CustomersPage(props: PageProps<"/customers">) {
  const sp = await props.searchParams;
  const sorts = parseSortParam(typeof sp.sort === "string" ? sp.sort : undefined);
  const groupBy = groupFromSearchParam(sp.group, CUSTOMER_GROUP_IDS);
  const filters = filtersFromSearchParam(sp.f);
  const { rows, total } = await listCustomers({ sorts, groupBy, filters });

  return (
    <CustomersListView rows={rows} total={total} groupBy={groupBy?.propertyId} />
  );
}
