import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import { ScorecardEditor } from "@/components/settings/scorecards/scorecard-editor";
import { getScorecardEditorView } from "@/db/queries/scorecards";
import { getActiveWorkspaceDetails } from "@/db/queries/workspaces";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ScorecardEditorPage({ params }: Props) {
  const { id } = await params;
  const [scorecard, workspace] = await Promise.all([
    getScorecardEditorView(id),
    getActiveWorkspaceDetails(),
  ]);
  if (!scorecard) notFound();

  return (
    <>
      <Topbar
        crumbs={[
          { label: workspace?.name ?? "Workspace" },
          { label: "Settings", href: "/settings" },
          { label: "Scorecards", href: "/settings/scorecards" },
          { label: scorecard.name },
        ]}
      />
      <SettingsBody>
        <ScorecardEditor scorecard={scorecard} />
      </SettingsBody>
    </>
  );
}
