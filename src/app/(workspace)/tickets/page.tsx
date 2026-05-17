import { Topbar } from "@/components/shell/topbar";
import { ticketColumns } from "@/components/tickets/columns";
import { TicketsTable } from "@/components/tickets/tickets-table";
import { TicketsToolbar } from "@/components/tickets/toolbar";
import {
  listTickets,
  type SortDir,
  type TicketSortKey,
} from "@/db/queries/tickets";
import { TICKET_VIEWS } from "@/lib/views";

const PAGE_SIZE = 50;

const VALID_SORTS: TicketSortKey[] = [
  "createdAt",
  "subject",
  "status",
  "channel",
  "closedAt",
  "solvedAt",
];

function parseSort(v: string | undefined): TicketSortKey {
  if (v && (VALID_SORTS as string[]).includes(v)) return v as TicketSortKey;
  return "closedAt";
}

function parseDir(v: string | undefined): SortDir {
  return v === "asc" ? "asc" : "desc";
}

function parsePage(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default async function TicketsPage(props: PageProps<"/tickets">) {
  const sp = await props.searchParams;
  const sort = parseSort(typeof sp.sort === "string" ? sp.sort : undefined);
  const dir = parseDir(typeof sp.dir === "string" ? sp.dir : undefined);
  const page = parsePage(typeof sp.page === "string" ? sp.page : undefined);
  const view = typeof sp.view === "string" ? sp.view : undefined;

  const { rows, total } = await listTickets({
    page,
    pageSize: PAGE_SIZE,
    sort,
    dir,
    view,
  });

  const activeView = TICKET_VIEWS.find((v) => v.id === (view ?? "all"));

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Tickets", href: "/tickets" },
          { label: activeView?.label ?? "All tickets" },
        ]}
      />
      <TicketsToolbar />
      <TicketsTable
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        sort={sort}
        dir={dir}
        columns={ticketColumns}
      />
    </>
  );
}
