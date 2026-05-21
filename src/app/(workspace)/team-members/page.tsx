import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ColumnStateProvider } from "@/lib/column-prefs";
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
  const { rows, total } = await listTeamMembers({ view, sorts });
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
      <EntityTable
        rows={rows}
        idField="id"
        properties={TEAM_MEMBER_PROPERTIES}
        page={1}
        pageSize={total || 1}
        total={total}
        basePath="/team-members"
        drawerEntity="team-member"
        serverSorted
      />
    </ColumnStateProvider>
  );
}
