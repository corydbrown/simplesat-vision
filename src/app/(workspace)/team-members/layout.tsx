import {
  SecondaryNav,
  ViewsGroup,
} from "@/components/shell/secondary-nav";
import { ViewNavLink } from "@/components/shell/nav-link";
import { db, schema } from "@/db/client";
import { TEAM_MEMBER_VIEWS } from "@/lib/views";

export default async function TeamMembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const total = await db.$count(schema.teamMembers);
  return (
    <div className="flex flex-1 min-w-0">
      <SecondaryNav title="Team members" count={total.toLocaleString()}>
        <ViewsGroup label="Views">
          {TEAM_MEMBER_VIEWS.map((v) => (
            <ViewNavLink
              key={v.id}
              href={
                v.id === "all" ? "/team-members" : `/team-members?view=${v.id}`
              }
              viewId={v.id}
              label={v.label}
            />
          ))}
        </ViewsGroup>
      </SecondaryNav>
      <div className="flex flex-1 flex-col min-w-0">{children}</div>
    </div>
  );
}
