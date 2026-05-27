import { TeamMembersListView } from "@/components/team-members/team-members-list-view";
import { filtersFromSearchParam } from "@/lib/filters/url-state";
import { TEAM_MEMBER_GROUP_IDS } from "@/lib/group/fields/team-members";
import { groupFromSearchParam } from "@/lib/group/url-state";
import { parseSortParam } from "@/lib/sort/url-state";
import { listTeamMembers } from "@/db/queries/team-members";

export default async function TeamMembersPage(
  props: PageProps<"/team-members">,
) {
  const sp = await props.searchParams;
  const sorts = parseSortParam(typeof sp.sort === "string" ? sp.sort : undefined);
  const groupBy = groupFromSearchParam(sp.group, TEAM_MEMBER_GROUP_IDS);
  const filters = filtersFromSearchParam(sp.f);
  const { rows, total } = await listTeamMembers({ sorts, groupBy, filters });

  return (
    <TeamMembersListView
      rows={rows}
      total={total}
      groupBy={groupBy?.propertyId}
    />
  );
}
