import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ListFilterRow } from "@/components/shared/list-filter-row";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { filtersFromSearchParam } from "@/lib/filters/url-state";
import { TICKET_GROUP_IDS } from "@/lib/group/fields/tickets";
import { groupFromSearchParam } from "@/lib/group/url-state";
import { TICKET_PROPERTIES } from "@/lib/properties/tickets";
import { parseSortParam } from "@/lib/sort/url-state";
import { listTickets } from "@/db/queries/tickets";
import { TICKET_VIEWS } from "@/lib/views";

const PAGE_SIZE = 50;

function parsePage(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default async function TicketsPage(props: PageProps<"/tickets">) {
  const sp = await props.searchParams;
  const sorts = parseSortParam(typeof sp.sort === "string" ? sp.sort : undefined);
  const page = parsePage(typeof sp.page === "string" ? sp.page : undefined);
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const filters = filtersFromSearchParam(sp.f);
  const groupBy = groupFromSearchParam(sp.group, TICKET_GROUP_IDS);

  const { rows, total } = await listTickets({
    page,
    pageSize: PAGE_SIZE,
    sorts,
    view,
    filters,
    groupBy,
  });

  const activeView = TICKET_VIEWS.find((v) => v.id === (view ?? "all"));

  return (
    <ColumnStateProvider tableId="tickets" properties={TICKET_PROPERTIES}>
      <Topbar
        crumbs={[
          { label: "Tickets", href: "/tickets" },
          { label: activeView?.label ?? "All tickets" },
        ]}
      />
      <EntityToolbar
        properties={TICKET_PROPERTIES}
        searchPlaceholder="Search tickets..."
      />
      <ListFilterRow properties={TICKET_PROPERTIES} />
      <EntityTable
        rows={rows}
        idField="id"
        properties={TICKET_PROPERTIES}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        groupBy={groupBy?.propertyId}
        basePath="/tickets"
        drawerEntity="ticket"
        serverSorted
      />
    </ColumnStateProvider>
  );
}
