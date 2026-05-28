import { notFound } from "next/navigation";

import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import { RuleEditor } from "@/components/settings/auto-scoring/rule-editor";
import { listScorecards } from "@/db/queries/scorecards";
import { getActiveWorkspaceDetails } from "@/db/queries/workspaces";

export default async function NewAutoScoringRulePage() {
  const [scorecards, workspace] = await Promise.all([
    listScorecards(),
    getActiveWorkspaceDetails(),
  ]);

  const liveScorecards = scorecards.filter((s) => s.archivedAt == null);
  if (liveScorecards.length === 0) {
    // No live scorecards = nowhere to route. Redirect to scorecards page
    // would be friendlier, but a 404 is correct given the URL contract.
    notFound();
  }

  return (
    <>
      <Topbar
        crumbs={[
          { label: workspace?.name ?? "Workspace" },
          { label: "Settings", href: "/settings" },
          { label: "Auto-scoring", href: "/settings/auto-scoring" },
          { label: "New rule" },
        ]}
      />
      <SettingsBody>
        <RuleEditor mode="create" scorecards={liveScorecards} />
      </SettingsBody>
    </>
  );
}
