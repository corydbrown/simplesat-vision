import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import {
  getActiveWorkspaceDetails,
  listWorkspaceMembers,
} from "@/db/queries/workspaces";
import { formatDate } from "@/lib/format";

export default async function WorkspaceUsersPage() {
  const [workspace, members] = await Promise.all([
    getActiveWorkspaceDetails(),
    listWorkspaceMembers(),
  ]);

  if (!workspace) {
    return (
      <>
        <Topbar
          crumbs={[
            { label: "Settings", href: "/settings" },
            { label: "Users" },
          ]}
        />
        <SettingsBody>
          <p className="text-base text-muted-foreground">Workspace not found.</p>
        </SettingsBody>
      </>
    );
  }

  return (
    <>
      <Topbar
        crumbs={[
          { label: workspace.name },
          { label: "Settings", href: "/settings" },
          { label: "Users" },
        ]}
      />
      <SettingsBody>
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Users
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {members.length} {members.length === 1 ? "user" : "users"} have
            access to this workspace. Users are added by your Simplesat account
            team.
          </p>

          <section className="mt-8">
            <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                      User
                    </th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                      Role
                    </th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member) => (
                    <tr key={member.userId}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={member.name}
                            email={member.email}
                            avatarUrl={member.avatarUrl}
                          />
                          <div className="min-w-0">
                            {member.name && (
                              <div className="text-foreground">{member.name}</div>
                            )}
                            <div className="text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="capitalize text-muted-foreground">
                          {member.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatDate(member.joinedAt)}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">
                        No users yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </SettingsBody>
    </>
  );
}

function Avatar({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : email[0].toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name ?? email}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-foreground">
      {initials}
    </div>
  );
}
