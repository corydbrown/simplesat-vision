export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EFFORT_BADGE_CLASS,
  priorityClass,
  severityClass,
  severityRank,
} from "@/lib/design-reviews/badges";
import { formatReviewDate } from "@/lib/design-reviews/format";
import { getReviewBySlug } from "@/lib/design-reviews/registry";
import type {
  Dimension,
  Priority,
  TopRecommendation,
} from "@/lib/design-reviews/types";

const PRIORITY_ORDER: Priority[] = ["P1", "P2", "P3"];

export default async function DesignReviewDetailPage(
  props: PageProps<"/design/[slug]">,
) {
  const { slug } = await props.params;
  const entry = getReviewBySlug(slug);
  if (!entry) notFound();

  const { meta, review } = entry;
  const { synthesis } = review;
  const dimensions = [...review.dimensions].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  return (
    <div className="flex-1 min-w-0">
      <Topbar
        crumbs={[
          { label: "Design", href: "/design" },
          { label: `Review #${meta.reviewNumber}` },
        ]}
      />

      <main className="mx-auto max-w-4xl px-10 py-10 xl:px-14">
        <Link
          href="/design"
          className="inline-flex cursor-pointer items-center gap-1.5 text-base text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All reviews
        </Link>

        {/* Header */}
        <header className="mt-4 border-b border-border pb-8">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-base text-muted-foreground">
                <span className="font-medium text-foreground">
                  Review #{meta.reviewNumber}
                </span>
                <span aria-hidden>·</span>
                <span>{formatReviewDate(meta.date)}</span>
              </div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                {meta.title}
              </h1>
            </div>
            <div className="flex shrink-0 flex-col items-center">
              <span className="text-3xl font-semibold leading-none text-foreground">
                {meta.healthGrade}
              </span>
              <span className="text-base text-muted-foreground">grade</span>
            </div>
          </div>
          <p className="mt-4 max-w-prose text-base text-foreground">
            {synthesis.executiveSummary}
          </p>
          <p className="mt-4 text-base text-muted-foreground">{meta.method}</p>
        </header>

        {/* Dimensions */}
        <Section title="Dimensions">
          <div className="space-y-5">
            {dimensions.map((d) => (
              <DimensionCard key={d.dimension} dimension={d} />
            ))}
          </div>
        </Section>

        {/* Cross-cutting themes */}
        <Section title="Cross-cutting themes">
          <ul className="space-y-3">
            {synthesis.crossCuttingThemes.map((theme, i) => (
              <li key={i} className="flex gap-3 text-base text-foreground">
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground"
                />
                <span className="max-w-prose">{theme}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Top recommendations */}
        <Section title="Top recommendations">
          <div className="space-y-6">
            {PRIORITY_ORDER.map((p) => {
              const recs = synthesis.topRecommendations.filter(
                (r) => r.priority === p,
              );
              if (recs.length === 0) return null;
              return (
                <div key={p} className="space-y-3">
                  <Badge className={priorityClass(p)}>{p}</Badge>
                  {recs.map((r, i) => (
                    <RecommendationCard key={i} rec={r} />
                  ))}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Remediation tasks */}
        <Section title="Suggested remediation tasks">
          <p className="mb-3 max-w-prose text-base text-muted-foreground">
            Scoped to become sub-tasks under the parent epic. Effort is a rough
            t-shirt size.
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Effort</TableHead>
                  <TableHead>Task</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {synthesis.suggestedRemediationTasks.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="align-top">
                      <Badge className={EFFORT_BADGE_CLASS}>{t.effort}</Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-medium text-foreground">
                        {t.title}
                      </div>
                      <p className="mt-1 max-w-prose text-base text-muted-foreground">
                        {t.scope}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DimensionCard({ dimension: d }: { dimension: Dimension }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={severityClass(d.severity)}>{d.severity}</Badge>
        <h3 className="text-base font-semibold text-foreground">
          {d.dimension}
        </h3>
        <span className="text-base text-muted-foreground">
          ~{d.approxTotalCount} {d.approxTotalCount === 1 ? "instance" : "instances"}
        </span>
      </div>

      <p className="mt-3 max-w-prose text-base text-muted-foreground">
        {d.summary}
      </p>

      {d.findings.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Location</TableHead>
                <TableHead>Issue &amp; recommendation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.findings.map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="align-top">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                      {f.file}:{f.line}
                    </code>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="text-base text-foreground">{f.issue}</div>
                    {f.snippet && (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-sm text-muted-foreground">
                        {f.snippet}
                      </pre>
                    )}
                    <div className="mt-2 text-base text-muted-foreground">
                      <span className="font-medium text-foreground">Fix:</span>{" "}
                      {f.recommendation}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Separator className="my-4" />
      <div className="max-w-prose text-base text-muted-foreground">
        <span className="font-medium text-foreground">Systemic fix:</span>{" "}
        {d.systemicRecommendation}
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: TopRecommendation }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-medium text-foreground">{rec.recommendation}</div>
      <p className="mt-1 max-w-prose text-base text-muted-foreground">
        {rec.rationale}
      </p>
      {rec.affectedDimensions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rec.affectedDimensions.map((dim) => (
            <Badge key={dim} variant="outline">
              {dim}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
