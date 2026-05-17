import { Topbar } from "@/components/shell/topbar";
import {
  CustomerPill,
  ResponsePill,
  TeamMemberPill,
  TicketPill,
} from "@/components/shared/entity-pill";
import { listResponses } from "@/db/queries/responses";
import { formatDateTime, formatNumber } from "@/lib/format";
import { RESPONSE_VIEWS } from "@/lib/views";

export default async function ResponsesPage(props: PageProps<"/responses">) {
  const sp = await props.searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const { rows, total } = await listResponses({ view, limit: 200 });
  const activeView = RESPONSE_VIEWS.find((v) => v.id === (view ?? "all"));

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Responses", href: "/responses" },
          { label: activeView?.label ?? "All responses" },
        ]}
      />
      <div className="flex items-center justify-between border-b border-border bg-background px-5 py-1.5">
        <div className="text-xs text-muted-foreground">
          {formatNumber(total)} response{total === 1 ? "" : "s"}
          {rows.length < total && (
            <span className="ml-2 text-muted-foreground/60">
              · showing latest {formatNumber(rows.length)}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              {["Rating", "Comment", "Ticket", "Customer", "Agent", "Responded"].map(
                (h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-10 bg-background px-3 py-2 text-left font-medium text-xs text-muted-foreground border-b border-r border-border"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-accent/40">
                <td className="px-3 py-1.5 border-b border-r border-border">
                  <ResponsePill rating={r.rating} scale={r.scale} />
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border max-w-xl">
                  {r.comment ? (
                    <span className="text-foreground/80 line-clamp-2">
                      {r.comment}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  {r.ticketId ? (
                    <TicketPill
                      id={r.ticketId}
                      subject={r.ticketSubject ?? undefined}
                    />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  {r.customerId && r.customerName ? (
                    <CustomerPill id={r.customerId} name={r.customerName} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  {r.teamMemberId &&
                  r.teamMemberName &&
                  r.teamMemberAvatarColor ? (
                    <TeamMemberPill
                      id={r.teamMemberId}
                      name={r.teamMemberName}
                      avatarColor={r.teamMemberAvatarColor}
                    />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border tabular-nums text-muted-foreground">
                  {formatDateTime(r.respondedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
