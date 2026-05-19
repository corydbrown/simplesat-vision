import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import {
  getRatingHistogram,
  getTeamMemberById,
  getTeamMemberResponses,
  getTeamMemberTickets,
  type TeamMemberListRow,
} from "@/db/queries/team-members";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const member = await getTeamMemberById(id);
  if (!member) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const [tickets, responses, histogram, group] = await Promise.all([
    getTeamMemberTickets(id, 50),
    getTeamMemberResponses(id, 50),
    getRatingHistogram(id),
    member.groupId
      ? db
          .select({ name: schema.teamMemberGroups.name })
          .from(schema.teamMemberGroups)
          .where(eq(schema.teamMemberGroups.id, member.groupId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const memberRow: TeamMemberListRow = {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    team: member.team,
    region: member.region,
    language: member.language,
    groupId: member.groupId,
    groupName: group?.name ?? null,
    avatarColor: member.avatarColor,
    customProperties: member.customProperties,
    totalTickets: member.stats.totalTickets,
    avgRating: member.stats.avgRating,
    totalResponses: member.stats.totalResponses,
  };

  return NextResponse.json({ member, memberRow, tickets, responses, histogram });
}
