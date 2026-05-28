import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { SettingsBody } from "@/components/settings/settings-body";
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
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Scorecards
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Rubrics used to evaluate ticket quality. Existing evaluations stay
            pinned to the version of the scorecard that produced them.
          </p>

          <div className="mt-8 flex flex-col gap-2">
            {scorecards.map((s) => (
              <Link
                key={s.id}
                href={`/settings/scorecards/${s.id}`}
                className="group flex items-center gap-4 rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-foreground">
                      {s.name}
                    </span>
                  </div>
                  <div className="mt-1 text-base text-muted-foreground">
                    {s.categoryCount}{" "}
                    {s.categoryCount === 1 ? "category" : "categories"} ·{" "}
                    {s.criteriaCount}{" "}
                    {s.criteriaCount === 1 ? "criterion" : "criteria"} · v
                    {s.version}
                  </div>
                </div>
                <ArrowUpRight
                  size={16}
                  className="shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground"
                />
              </Link>
            ))}
          </div>
        </div>
      </SettingsBody>
    </>
  );
}
