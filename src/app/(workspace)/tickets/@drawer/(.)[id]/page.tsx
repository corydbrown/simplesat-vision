import { notFound } from "next/navigation";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { TicketDetailBody } from "@/components/tickets/ticket-detail";
import { getTicketById } from "@/db/queries/tickets";

export default async function TicketDrawer(
  props: PageProps<"/tickets/[id]">,
) {
  const { id } = await props.params;
  const ticket = await getTicketById(id);
  if (!ticket) notFound();

  return (
    <DetailDrawer closeHref="/tickets">
      <TicketDetailBody ticket={ticket} />
    </DetailDrawer>
  );
}
