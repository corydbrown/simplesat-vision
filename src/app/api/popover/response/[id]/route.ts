import { NextResponse } from "next/server";
import { getResponseById } from "@/db/queries/responses";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const response = await getResponseById(id);
  if (!response) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: response.id,
    rating: response.rating,
    scale: response.scale,
    comment: response.comment,
    respondedAt: response.respondedAt.toISOString(),
    ticket: response.ticket
      ? {
          id: response.ticket.id,
          subject: response.ticket.subject,
          externalId: response.ticket.externalId,
        }
      : null,
    customer: response.customer
      ? {
          id: response.customer.id,
          name: response.customer.name,
          organization: response.customer.organization,
        }
      : null,
    teamMember: response.teamMember
      ? {
          id: response.teamMember.id,
          name: response.teamMember.name,
          avatarColor: response.teamMember.avatarColor,
        }
      : null,
  });
}
