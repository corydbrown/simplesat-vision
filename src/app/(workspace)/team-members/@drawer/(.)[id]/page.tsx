import { notFound } from "next/navigation";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { TeamMemberDetailBody } from "@/components/team-members/team-member-detail";
import {
  getRatingHistogram,
  getTeamMemberById,
  getTeamMemberTickets,
} from "@/db/queries/team-members";

export default async function TeamMemberDrawer(
  props: PageProps<"/team-members/[id]">,
) {
  const { id } = await props.params;
  const member = await getTeamMemberById(id);
  if (!member) notFound();
  const [tickets, histogram] = await Promise.all([
    getTeamMemberTickets(id, 50),
    getRatingHistogram(id),
  ]);

  return (
    <DetailDrawer closeHref="/team-members">
      <TeamMemberDetailBody
        member={member}
        tickets={tickets}
        histogram={histogram}
      />
    </DetailDrawer>
  );
}
