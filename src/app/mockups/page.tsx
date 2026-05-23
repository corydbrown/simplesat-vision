import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MOCKUPS } from "@/lib/mockups/registry";

export default function MockupsIndexPage() {
  const grouped = new Map<string, typeof MOCKUPS>();
  for (const m of MOCKUPS) {
    const arr = grouped.get(m.theme) ?? [];
    arr.push(m);
    grouped.set(m.theme, arr);
  }

  return (
    <div className="space-y-8">
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

      {Array.from(grouped.entries()).map(([theme, variants]) => (
        <section key={theme} className="space-y-3">
          <h2 className="text-xl font-semibold capitalize">
            {theme.replace(/-/g, " ")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {variants.map((m) => (
              <MockupCard key={m.path} mockup={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MockupCard({ mockup: m }: { mockup: (typeof MOCKUPS)[number] }) {
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
