import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MOCKUPS, type MockupMeta } from "@/lib/mockups/registry";

export default function MockupsIndexPage() {
  const rounds = groupByRound(MOCKUPS);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Mockups gallery
        </h1>
        <p className="text-base text-muted-foreground">
          Exploratory variations. Hardcoded data only. Pick favorites; rejected
          mockups get deleted next cleanup. See{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            CLAUDE.md
          </code>{" "}
          → Product values (SUF) for the criteria we&rsquo;re filtering against.
        </p>
      </header>

      {rounds.map(({ round, date, entries }) => (
        <section key={round} className="space-y-3">
          <h2 className="text-xl font-semibold">
            Round {round}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              · {formatRoundDate(date)}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {entries.map((m) => (
              <MockupCard key={m.path} mockup={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type RoundGroup = { round: number; date: string; entries: MockupMeta[] };

function groupByRound(mockups: MockupMeta[]): RoundGroup[] {
  const byRound = new Map<number, MockupMeta[]>();
  for (const m of mockups) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }

  return Array.from(byRound.entries())
    .map(([round, entries]) => {
      const sorted = [...entries].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      return { round, date: sorted[0].createdAt, entries: sorted };
    })
    .sort((a, b) => b.round - a.round);
}

function formatRoundDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function MockupCard({ mockup: m }: { mockup: MockupMeta }) {
  const statusClasses: Record<typeof m.status, string> = {
    exploring: "bg-grey-lighter text-grey-darker",
    loved: "bg-green-lighter text-green-darker",
    rejected: "bg-red-lighter text-red-darker",
    promoted: "bg-blue-lighter text-blue-darker",
  };
  const sufClasses: Record<typeof m.sufAxis, string> = {
    simple: "bg-purple-lighter text-purple-darker",
    useful: "bg-yellow-lighter text-yellow-darker",
    fun: "bg-teal-lighter text-teal-darker",
  };

  const inner = (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-medium ${statusClasses[m.status]}`}
        >
          {m.status}
        </span>
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-medium capitalize ${sufClasses[m.sufAxis]}`}
        >
          {m.sufAxis}
        </span>
        {m.ready ? null : (
          <span className="ml-auto text-sm text-muted-foreground">
            not yet built
          </span>
        )}
      </div>
      <h3 className="mb-1 text-base font-semibold text-foreground">
        {m.title}
      </h3>
      <p className="mb-3 flex-1 text-base text-muted-foreground">
        {m.hypothesis}
      </p>
      {m.ready && (
        <div className="inline-flex items-center gap-1 text-base font-medium text-primary">
          Open mockup
          <ArrowUpRight className="size-4" />
        </div>
      )}
    </div>
  );

  if (!m.ready) {
    return <div className="opacity-60">{inner}</div>;
  }
  return (
    <Link href={m.path} className="block">
      {inner}
    </Link>
  );
}
