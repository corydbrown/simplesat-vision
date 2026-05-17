export const dynamic = "force-dynamic";

import {
  SecondaryNav,
  ViewsGroup,
} from "@/components/shell/secondary-nav";
import { ViewNavLink } from "@/components/shell/nav-link";
import { db, schema } from "@/db/client";
import { formatNumber } from "@/lib/format";
import { TEAM_MEMBER_VIEWS } from "@/lib/views";
import { teamMembersViewCounts } from "@/lib/view-predicates";

export default async function TeamMembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [total, counts] = await Promise.all([
    db.$count(schema.teamMembers),
    teamMembersViewCounts(TEAM_MEMBER_VIEWS.map((v) => v.id)),
  ]);
  return (
    <div className="flex flex-1 min-w-0">
      <SecondaryNav title="Team members" count={formatNumber(total)}>
        <ViewsGroup label="Views">
          {TEAM_MEMBER_VIEWS.map((v) => (
            <ViewNavLink
              key={v.id}
              href={
                v.id === "all" ? "/team-members" : `/team-members?view=${v.id}`
              }
              viewId={v.id}
              label={v.label}
              count={formatNumber(counts[v.id] ?? 0)}
            />
          ))}
        </ViewsGroup>
      </SecondaryNav>
      <div className="flex flex-1 flex-col min-w-0">{children}</div>
    </div>
  );
}
