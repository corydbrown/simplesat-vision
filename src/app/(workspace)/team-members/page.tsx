import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ListFilterRow } from "@/components/shared/list-filter-row";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { filtersFromSearchParam } from "@/lib/filters/url-state";
import { TEAM_MEMBER_GROUP_IDS } from "@/lib/group/fields/team-members";
import { groupFromSearchParam } from "@/lib/group/url-state";
import { TEAM_MEMBER_PROPERTIES } from "@/lib/properties/team-members";
import { parseSortParam } from "@/lib/sort/url-state";
import { listTeamMembers } from "@/db/queries/team-members";
import { TEAM_MEMBER_VIEWS } from "@/lib/views";

export default async function TeamMembersPage(
  props: PageProps<"/team-members">,
) {
  const sp = await props.searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const sorts = parseSortParam(typeof sp.sort === "string" ? sp.sort : undefined);
  const groupBy = groupFromSearchParam(sp.group, TEAM_MEMBER_GROUP_IDS);
  const filters = filtersFromSearchParam(sp.f);
  const { rows, total } = await listTeamMembers({
    view,
    sorts,
    groupBy,
    filters,
  });
  const activeView = TEAM_MEMBER_VIEWS.find((v) => v.id === (view ?? "all"));

  return (
    <ColumnStateProvider
      tableId="team-members"
      properties={TEAM_MEMBER_PROPERTIES}
    >
      <Topbar
        crumbs={[
          { label: "Team members", href: "/team-members" },
          { label: activeView?.label ?? "All members" },
        ]}
      />
      <EntityToolbar
        properties={TEAM_MEMBER_PROPERTIES}
        searchPlaceholder="Search team members..."
      />
      <ListFilterRow properties={TEAM_MEMBER_PROPERTIES} />
      <EntityTable
        rows={rows}
        idField="id"
        properties={TEAM_MEMBER_PROPERTIES}
        page={1}
        pageSize={total || 1}
        total={total}
        groupBy={groupBy?.propertyId}
        basePath="/team-members"
        drawerEntity="team-member"
        serverSorted
      />
    </ColumnStateProvider>
  );
}
