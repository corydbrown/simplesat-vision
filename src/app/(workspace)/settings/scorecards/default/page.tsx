import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import { ScorecardEditor } from "@/components/settings/scorecards/scorecard-editor";
import {
  getDefaultScorecard,
  getScorecardEditorView,
} from "@/db/queries/scorecards";

export default async function DefaultScorecardEditorPage() {
  const summary = await getDefaultScorecard();
  if (!summary) notFound();
  const scorecard = await getScorecardEditorView(summary.id);
  if (!scorecard) notFound();

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Bloom Beauty" },
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
