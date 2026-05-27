"use client";

import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ListFilterRow } from "@/components/shared/list-filter-row";
import { ListPageActions } from "@/components/shared/list-page-actions";
import { ViewBreadcrumb } from "@/components/shared/view-breadcrumb";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { useTeamMemberProperties } from "@/lib/properties/custom-fields-context";
import type { TeamMemberListRow } from "@/db/queries/team-members";

/**
 * Client view for the team-members list. Properties come from
 * `useTeamMemberProperties()` so the custom-attribute columns follow the active
 * workspace — the parent server page just fetches the rows.
 */
export function TeamMembersListView({
  rows,
  total,
  groupBy,
  allowedGroupIds,
}: {
  rows: TeamMemberListRow[];
  total: number;
  groupBy?: string;
  /** Group-by field ids, passed from the server page (the `group/fields`
   *  module is `server-only` and must not be imported by this client view). */
  allowedGroupIds: string[];
}) {
  const properties = useTeamMemberProperties();

  return (
    <ColumnStateProvider
      tableId="team-members"
      properties={properties}
      entityKey="team-members"
    >
      <Topbar
        crumbs={[
          { label: "Team members", href: "/team-members" },
          {
            label: "All members",
            node: <ViewBreadcrumb entityKey="team-members" />,
          },
        ]}
        actions={
          <ListPageActions entityKey="team-members" basePath="/team-members" />
        }
      />
      <EntityToolbar
        properties={properties}
        searchPlaceholder="Search team members..."
        viewContext={{
          entityKey: "team-members",
          basePath: "/team-members",
          allowedGroupIds,
        }}
      />
      <ListFilterRow properties={properties} />
      <EntityTable
        rows={rows}
        idField="id"
        properties={properties}
        page={1}
        pageSize={total || 1}
        total={total}
        groupBy={groupBy}
        basePath="/team-members"
        drawerEntity="team-member"
        serverSorted
      />
    </ColumnStateProvider>
  );
}
