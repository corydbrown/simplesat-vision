import { NextResponse } from "next/server";
import { getTicketById } from "@/db/queries/tickets";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ticket = await getTicketById(id);
  if (!ticket) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    id: ticket.id,
    externalId: ticket.helpdeskExternalId,
    subject: ticket.subject,
    status: ticket.status,
    channel: ticket.channel,
    customer: ticket.customer
      ? {
          id: ticket.customer.id,
          name: ticket.customer.name,
          company: ticket.customer.company,
        }
      : null,
    teamMember: ticket.assignee
      ? {
          id: ticket.assignee.id,
          name: ticket.assignee.name,
          avatarColor: ticket.assignee.avatarColor,
        }
      : null,
    rating: ticket.response?.rating ?? null,
    scale: ticket.response?.scale ?? null,
    createdAt: ticket.createdAt.toISOString(),
    solvedAt: ticket.solvedAt ? ticket.solvedAt.toISOString() : null,
  });
}
