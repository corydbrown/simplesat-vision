import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { InviteUserDialog } from "@/components/settings/users/invite-user-dialog";
import { UserRowActions } from "@/components/settings/users/user-row-actions";
import { PendingInvitationRow } from "@/components/settings/users/pending-invitation-row";
import { Avatar } from "@/components/shared/avatar";
import {
  getActiveWorkspaceDetails,
  getCurrentUserRole,
} from "@/db/queries/workspaces";
import { getCurrentUser } from "@/lib/auth";
import { resolveAvatar } from "@/lib/avatar";
import { formatDate } from "@/lib/format";
import {
  listOrgMembers,
  listPendingInvitations,
  type OrgMember,
  type PendingInvitation,
} from "@/lib/users/workos";

type EnrichedInvitation = PendingInvitation & { expired: boolean };

type LoadResult =
  | { ok: true; members: OrgMember[]; invitations: EnrichedInvitation[] }
  | { ok: false; error: string };

async function loadForAdmin(role: "admin" | "member" | null): Promise<LoadResult> {
  try {
    const [members, invitations] = await Promise.all([
      listOrgMembers(),
      role === "admin" ? listPendingInvitations() : Promise.resolve([]),
    ]);
    const now = Date.now();
    return {
      ok: true,
      members,
      invitations: invitations.map((inv) => ({
        ...inv,
        expired: inv.expiresAt > 0 && inv.expiresAt < now,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't reach WorkOS";
    return { ok: false, error: message };
  }
}

export default async function WorkspaceUsersPage() {
  const [workspace, role, currentUser] = await Promise.all([
    getActiveWorkspaceDetails(),
    getCurrentUserRole(),
    getCurrentUser(),
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

  const crumbs = [
    { label: workspace.name },
    { label: "Settings", href: "/settings" },
    { label: "Users" },
  ];

  const isAdmin = role === "admin";
  const loaded = await loadForAdmin(role);

  return (
    <>
      <Topbar crumbs={crumbs} />
      <SettingsBody>
        <div className="max-w-3xl">
          <SettingsPageHeader
            title="Users"
            description={
              isAdmin
                ? `Manage who has access to ${workspace.name}.`
                : `People with access to ${workspace.name}.`
            }
            action={isAdmin && loaded.ok ? <InviteUserDialog /> : undefined}
          />

          {!loaded.ok ? (
            <p className="mt-8 rounded-lg bg-red-lighter px-4 py-3 text-base text-red-dark">
              {loaded.error}
            </p>
          ) : (
            <>
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
                          Status
                        </th>
                        <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                          Joined
                        </th>
                        {isAdmin && <th className="w-12 px-2 py-3" aria-label="Actions" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loaded.members.map((member) => (
                        <tr key={member.membershipId}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar
                                {...resolveAvatar({
                                  avatarUrl: member.avatarUrl,
                                  email: member.email,
                                  name: member.name ?? member.email,
                                })}
                                size="lg"
                              />
                              <div className="min-w-0">
                                {member.name && (
                                  <div className="text-foreground">
                                    {member.name}
                                  </div>
                                )}
                                <div className="text-muted-foreground">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="capitalize text-muted-foreground">
                              {member.role}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={member.status} />
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {formatDate(member.joinedAt)}
                          </td>
                          {isAdmin && (
                            <td className="px-2 py-3">
                              <UserRowActions
                                membershipId={member.membershipId}
                                workosUserId={member.workosUserId}
                                email={member.email}
                                role={member.role}
                                isSelf={
                                  currentUser?.workosId === member.workosUserId
                                }
                                workspaceName={workspace.name}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                      {loaded.members.length === 0 && (
                        <tr>
                          <td
                            colSpan={isAdmin ? 5 : 4}
                            className="px-5 py-8 text-center text-muted-foreground"
                          >
                            No users yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {isAdmin && loaded.invitations.length > 0 && (
                <section className="mt-10">
                  <h2 className="text-base font-medium text-foreground">
                    Pending invitations
                  </h2>
                  <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-foreground/10">
                    <table className="w-full text-base">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                            Email
                          </th>
                          <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                            Role
                          </th>
                          <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                            Sent
                          </th>
                          <th className="w-12 px-2 py-3" aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {loaded.invitations.map((inv) => (
                          <PendingInvitationRow
                            key={inv.id}
                            invitationId={inv.id}
                            email={inv.email}
                            role={inv.role}
                            createdAt={inv.createdAt}
                            expired={inv.expired}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </SettingsBody>
    </>
  );
}

const STATUS_STYLES: Record<"active" | "pending" | "inactive", string> = {
  active: "bg-green-lighter text-green-darker",
  pending: "bg-yellow-lighter text-yellow-darker",
  inactive: "bg-grey-lighter text-grey-darker",
};

const STATUS_LABELS: Record<"active" | "pending" | "inactive", string> = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
};

function StatusBadge({ status }: { status: "active" | "pending" | "inactive" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

