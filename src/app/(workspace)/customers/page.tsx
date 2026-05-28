import { Suspense } from "react";
import {
  CustomersListShell,
  CustomersTable,
} from "@/components/customers/customers-list-view";
import { EntityTableSkeleton } from "@/components/shared/table-skeleton";
import { filtersFromSearchParam } from "@/lib/filters/url-state";
import { CUSTOMER_GROUP_IDS } from "@/lib/group/fields/customers";
import { groupFromSearchParam } from "@/lib/group/url-state";
import { parseSortParam } from "@/lib/sort/url-state";
import { listCustomers } from "@/db/queries/customers";

type SP = Awaited<PageProps<"/customers">["searchParams"]>;

export default async function CustomersPage(props: PageProps<"/customers">) {
  const sp = await props.searchParams;

  return (
    <CustomersListShell allowedGroupIds={CUSTOMER_GROUP_IDS}>
      <Suspense fallback={<EntityTableSkeleton />}>
        <CustomersTableData sp={sp} />
      </Suspense>
    </CustomersListShell>
  );
}

async function CustomersTableData({ sp }: { sp: SP }) {
  const sorts = parseSortParam(typeof sp.sort === "string" ? sp.sort : undefined);
  const groupBy = groupFromSearchParam(sp.group, CUSTOMER_GROUP_IDS);
  const filters = filtersFromSearchParam(sp.f);
  const { rows, total } = await listCustomers({ sorts, groupBy, filters });

  return (
    <CustomersTable rows={rows} total={total} groupBy={groupBy?.propertyId} />
  );
}
