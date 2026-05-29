export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Badge } from "@/components/ui/badge";
import { severityClass, severityRank } from "@/lib/design-reviews/badges";
import { formatReviewDate } from "@/lib/design-reviews/format";
import { DESIGN_REVIEWS } from "@/lib/design-reviews/registry";
import type { DesignReviewMeta } from "@/lib/design-reviews/types";

export default function DesignReviewsPage() {
  return (
    <div className="flex-1 min-w-0">
      <Topbar crumbs={[{ label: "Design" }]} />

      <main className="mx-auto max-w-4xl px-10 py-10 xl:px-14">
        <header className="space-y-3 border-b border-border pb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Design reviews
          </h1>
          <p className="max-w-prose text-base text-muted-foreground">
            A running history of structured design-system audits. Each review is
            a point-in-time pass over the production UI — dimensions scored by
            severity, findings down to{" "}
            <span className="font-mono">file:line</span>, and remediation tasks
            ready to spin out. Newest first.
          </p>
        </header>

        <section className="mt-8 space-y-4">
          {DESIGN_REVIEWS.map(({ meta }) => (
            <ReviewCard key={meta.slug} meta={meta} />
          ))}
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="text-xl font-semibold">Other surfaces</h2>
          <Link
            href="/design/components"
            className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            <LayoutGrid className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                Live component audit
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </div>
              <p className="text-base text-muted-foreground">
                The companion surface: real components rendered next to their
                documented rule, with live token swatches, so visual drift shows
                at a glance. Not a point-in-time report — it always reflects the
                current build.
              </p>
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}

function ReviewCard({ meta }: { meta: DesignReviewMeta }) {
  const dimensions = [...meta.dimensions].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  return (
    <Link
      href={`/design/${meta.slug}`}
      className="block cursor-pointer rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <span className="font-medium text-foreground">
              Review #{meta.reviewNumber}
            </span>
            <span aria-hidden>·</span>
            <span>{formatReviewDate(meta.date)}</span>
          </div>
          <h3 className="mt-1 flex items-center gap-1 text-base font-semibold text-foreground">
            {meta.title}
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <span className="text-3xl font-semibold leading-none text-foreground">
            {meta.healthGrade}
          </span>
          <span className="text-base text-muted-foreground">grade</span>
        </div>
      </div>

      <p className="mt-3 max-w-prose text-base text-muted-foreground">
        {meta.summary}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {dimensions.map((d) => (
          <Badge key={d.name} className={severityClass(d.severity)}>
            {d.name}
            <span className="font-normal opacity-80">· {d.count}</span>
          </Badge>
        ))}
      </div>
    </Link>
  );
}
