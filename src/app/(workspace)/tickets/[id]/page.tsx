import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { TicketDetailBody } from "@/components/tickets/ticket-detail";
import { DetailActions } from "@/components/shared/detail-actions";
import { getTicketById } from "@/db/queries/tickets";

// SVP-243: TicketQaSection's EvaluateTicketButton fires `evaluateTicket` (LLM
// round-trip, ~15-25s). Lift the function ceiling so cold-start + the call
// doesn't blow the default budget. Mirrors the coaching routes.
export const maxDuration = 60;

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
