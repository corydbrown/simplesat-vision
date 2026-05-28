import { notFound } from "next/navigation";

import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import { RuleEditor } from "@/components/settings/auto-scoring/rule-editor";
import { getAutoScoringRule } from "@/db/queries/auto-scoring-rules";
import { listScorecards } from "@/db/queries/scorecards";
import { getActiveWorkspaceDetails } from "@/db/queries/workspaces";
import { requireWorkspace } from "@/lib/workspace";

export default async function AutoScoringRulePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const workspaceId = await requireWorkspace();
  const [rule, scorecards, workspace] = await Promise.all([
    getAutoScoringRule(workspaceId, id),
    listScorecards(),
    getActiveWorkspaceDetails(),
  ]);
  if (!rule) notFound();

  // Allow the rule's current scorecard even if archived (so the user can
  // see the current state and re-point it). New rule selections still
  // restrict to live scorecards.
  const pickableScorecards = scorecards.filter(
    (s) => s.archivedAt == null || s.id === rule.scorecardId,
  );

  return (
    <>
      <Topbar
        crumbs={[
          { label: workspace?.name ?? "Workspace" },
          { label: "Settings", href: "/settings" },
          { label: "Auto-scoring", href: "/settings/auto-scoring" },
          { label: rule.name },
        ]}
      />
      <SettingsBody>
        <RuleEditor
          mode="edit"
          rule={rule}
          scorecards={pickableScorecards}
        />
      </SettingsBody>
    </>
  );
}
