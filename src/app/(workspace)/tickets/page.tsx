import { Suspense } from "react";
import {
  TicketsListShell,
  TicketsTable,
} from "@/components/tickets/tickets-list-view";
import { EntityTableSkeleton } from "@/components/shared/table-skeleton";
import { filtersFromSearchParam } from "@/lib/filters/url-state";
import { TICKET_GROUP_IDS } from "@/lib/group/fields/tickets";
import { groupFromSearchParam } from "@/lib/group/url-state";
import { parseSortParam } from "@/lib/sort/url-state";
import { listTickets } from "@/db/queries/tickets";

const PAGE_SIZE = 50;

type SP = Awaited<PageProps<"/tickets">["searchParams"]>;

function parsePage(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default async function TicketsPage(props: PageProps<"/tickets">) {
  const sp = await props.searchParams;

  return (
    <TicketsListShell allowedGroupIds={TICKET_GROUP_IDS}>
      <Suspense fallback={<EntityTableSkeleton />}>
        <TicketsTableData sp={sp} />
      </Suspense>
    </TicketsListShell>
  );
}

async function TicketsTableData({ sp }: { sp: SP }) {
  const sorts = parseSortParam(typeof sp.sort === "string" ? sp.sort : undefined);
  const page = parsePage(typeof sp.page === "string" ? sp.page : undefined);
  const filters = filtersFromSearchParam(sp.f);
  const groupBy = groupFromSearchParam(sp.group, TICKET_GROUP_IDS);

  const { rows, total } = await listTickets({
    page,
    pageSize: PAGE_SIZE,
    sorts,
    filters,
    groupBy,
  });

  return (
    <TicketsTable
      rows={rows}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      groupBy={groupBy?.propertyId}
    />
  );
}
