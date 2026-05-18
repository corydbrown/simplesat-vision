import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { TeamMemberDetailBody } from "@/components/team-members/team-member-detail";
import {
  getRatingHistogram,
  getTeamMemberById,
  getTeamMemberResponses,
  getTeamMemberTickets,
} from "@/db/queries/team-members";
import type { TeamMemberListRow } from "@/db/queries/team-members";

type Tab = "tickets" | "responses";

export default async function TeamMemberDetailPage(
  props: PageProps<"/team-members/[id]">,
) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const tab: Tab = sp.tab === "responses" ? "responses" : "tickets";

  const member = await getTeamMemberById(id);
  if (!member) notFound();

  const [tickets, responses, histogram] = await Promise.all([
    getTeamMemberTickets(id, 50),
    getTeamMemberResponses(id, 50),
    getRatingHistogram(id),
  ]);

  const memberRow: TeamMemberListRow = {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    team: member.team,
    avatarColor: member.avatarColor,
    totalTickets: member.stats.totalTickets,
    avgRating: member.stats.avgRating,
    totalResponses: member.stats.totalResponses,
  };

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Team members", href: "/team-members" },
          { label: member.name },
        ]}
      />
      <TeamMemberDetailBody
        member={member}
        memberRow={memberRow}
        tickets={tickets}
        responses={responses}
        histogram={histogram}
        tab={tab}
      />
    </>
  );
}
