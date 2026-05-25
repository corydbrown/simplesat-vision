import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
import {
  getDefaultScorecard,
  getScorecardCategories,
} from "@/db/queries/scorecards";

export default async function DefaultScorecardEditorPage() {
  const scorecard = await getDefaultScorecard();
  if (!scorecard) notFound();
  const categories = await getScorecardCategories(scorecard.id);

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
        <div className="max-w-3xl">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {scorecard.name}
            </h1>
            <span className="text-base text-muted-foreground">
              v{scorecard.version}
            </span>
          </div>
          <p className="mt-2 text-base text-muted-foreground">
            {scorecard.categoryCount} categories · {scorecard.criteriaCount}{" "}
            criteria. Edits bump the scorecard version; existing evaluations
            stay pinned to the version that produced them.
          </p>

          <div className="mt-8 flex items-center gap-3 rounded-xl bg-accent/30 px-5 py-4 ring-1 ring-foreground/10">
            <Construction size={18} className="shrink-0 text-muted-foreground" />
            <div className="text-base text-muted-foreground">
              The editor is shipping in the next phase. The categories below
              are a preview of what you&rsquo;ll be able to weight, reorder,
              and edit.
            </div>
          </div>

          <h2 className="mt-10 text-base font-medium text-foreground">
            Categories
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-4 rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-foreground">
                      {c.name}
                    </span>
                    {c.isAutofail && (
                      <span className="rounded-full bg-red-lighter px-2 py-0.5 text-sm text-red-dark">
                        Auto-fail
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-base text-muted-foreground">
                    {c.criteriaCount}{" "}
                    {c.criteriaCount === 1 ? "criterion" : "criteria"}
                  </div>
                </div>
                <div className="shrink-0 text-base text-muted-foreground tabular-nums">
                  {c.isAutofail ? "—" : `${c.weightPercent}%`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SettingsBody>
    </>
  );
}
