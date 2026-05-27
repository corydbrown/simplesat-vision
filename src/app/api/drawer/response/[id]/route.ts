import { NextResponse } from "next/server";
import { getResponseById, type ResponseListRow } from "@/db/queries/responses";

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

  const responseRow: ResponseListRow = {
    id: response.id,
    rating: response.rating,
    scale: response.scale,
    comment: response.comment,
    respondedAt: response.respondedAt,
    answers: response.answers,
    topics: response.topics,
    ticketId: response.ticket?.id ?? null,
    ticketSubject: response.ticket?.subject ?? null,
    ticketExternalId: response.ticket?.externalId ?? null,
    customerId: response.customer?.id ?? null,
    customerName: response.customer?.name ?? null,
    customerOrganization: response.customer?.organization ?? null,
    teamMemberId: response.teamMember?.id ?? null,
    teamMemberName: response.teamMember?.name ?? null,
    teamMemberAvatarColor: response.teamMember?.avatarColor ?? null,
  };

  return NextResponse.json({ response, responseRow });
}
