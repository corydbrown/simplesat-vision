import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import { RulesList } from "@/components/settings/auto-scoring/rules-list";
import {
  countEvaluationsByRulesLast24h,
  listAutoScoringRules,
} from "@/db/queries/auto-scoring-rules";
import { listScorecards } from "@/db/queries/scorecards";
import { getActiveWorkspaceDetails } from "@/db/queries/workspaces";
import { requireWorkspace } from "@/lib/workspace";

export default async function AutoScoringSettingsPage() {
  const workspaceId = await requireWorkspace();
  const [rules, scorecards, workspace, scoredLast24h] = await Promise.all([
    listAutoScoringRules(workspaceId),
    listScorecards(),
    getActiveWorkspaceDetails(),
    countEvaluationsByRulesLast24h(workspaceId),
  ]);

  return (
    <>
      <Topbar
        crumbs={[
          { label: workspace?.name ?? "Workspace" },
          { label: "Settings", href: "/settings" },
          { label: "Auto-scoring" },
        ]}
      />
      <SettingsBody>
        <RulesList
          rules={rules}
          scorecards={scorecards}
          scoredLast24h={scoredLast24h}
        />
      </SettingsBody>
    </>
  );
}
