import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { TeamMemberDetailBody } from "@/components/team-members/team-member-detail";
import { DetailActions } from "@/components/shared/detail-actions";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import {
  getRatingHistogram,
  getTeamMemberBullshitStats,
  getTeamMemberById,
  getTeamMemberCoachingFeed,
  getTeamMemberQaRollup,
  getTeamMemberQaSparklines,
  getTeamMemberQaTiles,
  getTeamMemberResponses,
  getTeamMemberTickets,
} from "@/db/queries/team-members";
import type {
  TeamMemberBullshitStats,
  TeamMemberListRow,
} from "@/db/queries/team-members";

export default async function AgentDetailPage(
  props: PageProps<"/agents/[id]">,
) {
  const { id } = await props.params;

  const member = await getTeamMemberById(id);
  if (!member) notFound();

  const isAiAgent = member.kind === "ai_agent";

  const [
    tickets,
    responses,
    histogram,
    qaRollup,
    qaTiles,
    qaSparklines,
    coachingFeed,
    bullshitStats,
    group,
  ] = await Promise.all([
    getTeamMemberTickets(id, 50),
    getTeamMemberResponses(id, 50),
    getRatingHistogram(id),
    getTeamMemberQaRollup(id),
    getTeamMemberQaTiles(id),
    getTeamMemberQaSparklines(id),
    getTeamMemberCoachingFeed(id, 8),
    isAiAgent
      ? getTeamMemberBullshitStats(id)
      : (Promise.resolve(null) as Promise<TeamMemberBullshitStats | null>),
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
    avatarUrl: member.avatarUrl,
    customProperties: member.customProperties,
    kind: member.kind,
    totalTickets: member.stats.totalTickets,
    avgRating: member.stats.avgRating,
    totalResponses: member.stats.totalResponses,
  };

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Agents", href: "/agents" },
          { label: member.name },
        ]}
        actions={<DetailActions entityHref={`/agents/${member.id}`} />}
      />
      <TeamMemberDetailBody
        member={member}
        memberRow={memberRow}
        tickets={tickets}
        responses={responses}
        histogram={histogram}
        qaRollup={qaRollup}
        qaTiles={qaTiles}
        qaSparklines={qaSparklines}
        coachingFeed={coachingFeed}
        bullshitStats={bullshitStats}
      />
    </>
  );
}
