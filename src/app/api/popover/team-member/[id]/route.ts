import { NextResponse } from "next/server";
import { getTeamMemberById } from "@/db/queries/team-members";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const member = await getTeamMemberById(id);
  if (!member) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    team: member.team,
    avatarColor: member.avatarColor,
    totalTickets: member.stats.totalTickets,
    totalResponses: member.stats.totalResponses,
    avgRating: member.stats.avgRating,
  });
}
