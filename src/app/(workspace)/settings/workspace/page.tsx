import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import { Badge } from "@/components/ui/badge";
import { RenameForm } from "@/components/settings/workspace/rename-form";
import {
  getActiveWorkspaceDetails,
  listWorkspaceMembers,
  getCurrentUserRole,
} from "@/db/queries/workspaces";
import { formatDate } from "@/lib/format";

const INTEGRATION_LABELS: Record<string, string> = {
  intercom: "Intercom",
  zendesk: "Zendesk",
  mock: "Mock",
};

export default async function WorkspaceSettingsPage() {
  const [workspace, members, userRole] = await Promise.all([
    getActiveWorkspaceDetails(),
    listWorkspaceMembers(),
    getCurrentUserRole(),
  ]);

  if (!workspace) {
    return (
      <>
        <Topbar crumbs={[{ label: "Settings", href: "/settings" }, { label: "Workspace" }]} />
        <SettingsBody>
          <p className="text-base text-muted-foreground">Workspace not found.</p>
        </SettingsBody>
      </>
    );
  }

  const isAdmin = userRole === "admin";

  return (
    <>
      <Topbar
        crumbs={[
          { label: workspace.name },
          { label: "Settings", href: "/settings" },
          { label: "Workspace" },
        ]}
      />
      <SettingsBody>
        <div className="max-w-2xl">
          {/* Page header */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Workspace
            </h1>
            <Badge variant="secondary">
              {INTEGRATION_LABELS[workspace.integrationType] ?? workspace.integrationType}
            </Badge>
          </div>
          <p className="mt-2 text-base text-muted-foreground">
            Settings and members for this workspace.
          </p>

          {/* Section A: Details */}
          <section className="mt-10">
            <h2 className="text-base font-medium text-foreground">Details</h2>
            <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <dl className="divide-y divide-border">
                <Row label="Name">
                  <RenameForm currentName={workspace.name} isAdmin={isAdmin} />
                </Row>
                <Row label="Slug">
                  <span className="font-mono text-base text-muted-foreground">
                    {workspace.slug}
                  </span>
                </Row>
                <Row label="Integration">
                  <span className="text-base text-muted-foreground">
                    {INTEGRATION_LABELS[workspace.integrationType] ?? workspace.integrationType}
                  </span>
                </Row>
                <Row label="Created">
                  <span className="text-base text-muted-foreground">
                    {formatDate(workspace.createdAt)}
                  </span>
                </Row>
                {workspace.createdByName || workspace.createdByEmail ? (
                  <Row label="Created by">
                    <span className="text-base text-muted-foreground">
                      {workspace.createdByName
                        ? `${workspace.createdByName} (${workspace.createdByEmail})`
                        : workspace.createdByEmail}
                    </span>
                  </Row>
                ) : null}
              </dl>
            </div>
          </section>

          {/* Section B: Members */}
          <section className="mt-10">
            <h2 className="text-base font-medium text-foreground">Members</h2>
            <p className="mt-1 text-base text-muted-foreground">
              {members.length} {members.length === 1 ? "member" : "members"}.
              Members are added by your Simplesat account team.
            </p>
            <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                      Member
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
                        No members yet.
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 bg-card px-5 py-4">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
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
