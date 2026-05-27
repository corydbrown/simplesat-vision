import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { TicketDetailBody } from "@/components/tickets/ticket-detail";
import { DetailActions } from "@/components/shared/detail-actions";
import { getTicketById } from "@/db/queries/tickets";

export default async function TicketDetailPage(
  props: PageProps<"/tickets/[id]">,
) {
  const { id } = await props.params;
  const ticket = await getTicketById(id);
  if (!ticket) notFound();

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Tickets", href: "/tickets" },
          { label: ticket.externalId ?? ticket.id },
        ]}
        actions={<DetailActions entityHref={`/tickets/${ticket.id}`} />}
      />
      <TicketDetailBody ticket={ticket} />
    </>
  );
}
