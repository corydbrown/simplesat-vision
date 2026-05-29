import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import { ScorecardsList } from "@/components/settings/scorecards/scorecards-list";
import { listScorecards } from "@/db/queries/scorecards";
import { getActiveWorkspaceDetails } from "@/db/queries/workspaces";

export default async function ScorecardsSettingsPage() {
  const [scorecards, workspace] = await Promise.all([
    listScorecards(),
    getActiveWorkspaceDetails(),
  ]);

  return (
    <>
      <Topbar
        crumbs={[
          { label: workspace?.name ?? "Workspace" },
          { label: "Settings", href: "/settings" },
          { label: "Scorecards" },
        ]}
      />
      <SettingsBody>
        <ScorecardsList
          scorecards={scorecards}
          defaultScorecardId={workspace?.defaultScorecardId ?? null}
        />
      </SettingsBody>
    </>
  );
}
