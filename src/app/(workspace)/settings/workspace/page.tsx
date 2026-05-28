import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import { LogoForm } from "@/components/settings/workspace/logo-form";
import { RenameForm } from "@/components/settings/workspace/rename-form";
import { TeamMemberRuleForm } from "@/components/settings/workspace/team-member-rule-form";
import {
  getActiveWorkspaceDetails,
  getCurrentUserRole,
} from "@/db/queries/workspaces";
import { formatDate } from "@/lib/format";

export default async function WorkspaceSettingsPage() {
  const [workspace, userRole] = await Promise.all([
    getActiveWorkspaceDetails(),
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Workspace
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Settings for this workspace.
          </p>

          <section className="mt-8">
            <h2 className="text-base font-medium text-foreground">Logo</h2>
            <div className="mt-4 rounded-xl bg-card px-5 py-5 ring-1 ring-foreground/10">
              <LogoForm
                workspaceName={workspace.name}
                initialDomain={workspace.domain}
                initialLogoUrl={workspace.logoUrl}
                isAdmin={isAdmin}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-medium text-foreground">
              Team-member crediting
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Which role on each ticket gets credited as its team member.
              Changing this re-credits every imported ticket against its
              stored source data.
            </p>
            <div className="mt-4 rounded-xl bg-card px-5 py-5 ring-1 ring-foreground/10">
              <TeamMemberRuleForm
                initialRule={workspace.teamMemberResolutionRule}
                isAdmin={isAdmin}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-medium text-foreground">Details</h2>
            <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <dl className="divide-y divide-border">
                <Row label="Name">
                  <RenameForm currentName={workspace.name} isAdmin={isAdmin} />
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
