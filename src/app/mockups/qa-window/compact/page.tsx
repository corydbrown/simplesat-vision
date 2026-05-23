import {
  Check,
  ChevronRight,
  MessageSquareQuote,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import {
  sampleTicket,
  type SampleCategory,
  type SampleEvaluation,
  type SampleMessage,
} from "@/lib/mockups/sample-data";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";

const SCALE_MAX: Record<SampleCategory["scaleType"], number> = {
  likert_5: 5,
  three_state: 3,
  binary: 1,
};

type Severity = "quiet" | "growth" | "weak" | "fail";

function severityFor(c: SampleCategory): Severity {
  if (c.scaleType === "binary") {
    return c.effectiveScore === 1 ? "quiet" : "fail";
  }
  const pct = c.effectiveScore / SCALE_MAX[c.scaleType];
  if (pct >= 0.95) return "quiet";
  if (pct >= 0.75) return "growth";
  return "weak";
}

const cellClass: Record<Severity, string> = {
  quiet: "bg-grey-lighter/40 border-border hover:bg-grey-lighter/70",
  growth: "bg-yellow-lighter/70 border-yellow-light/50 hover:bg-yellow-lighter",
  weak: "bg-red-lighter/80 border-red-light hover:bg-red-lighter",
  fail: "bg-red-lighter border-red ring-1 ring-red-light hover:bg-red-lighter",
};

const headlineClass: Record<Severity, string> = {
  quiet: "text-foreground",
  growth: "text-yellow-darker",
  weak: "text-red-darker",
  fail: "text-red-darker",
};

const labelClass: Record<Severity, string> = {
  quiet: "text-muted-foreground",
  growth: "text-yellow-darker/80",
  weak: "text-red-darker/80",
  fail: "text-red-darker/80",
};

const dotFilledClass: Record<Severity, string> = {
  quiet: "bg-grey-darker/80",
  growth: "bg-yellow-darker",
  weak: "bg-red-darker",
  fail: "bg-red-darker",
};

export default function CompactQaWindowPage() {
  const t = sampleTicket;
  const ev = t.evaluation;
  const msgIndex = new Map<string, SampleMessage>(t.messages.map((m) => [m.id, m]));

  return (
    <div className="space-y-6 pb-16">
      <MockupCallout />
      <TicketHeader ticket={t} />
      <QaStrip evaluation={ev} msgIndex={msgIndex} />
      <Conversation messages={t.messages} categories={ev.categories} />
    </div>
  );
}

function MockupCallout() {
  return (
    <div className="rounded-md border border-purple-light/40 bg-purple-lighter/40 px-3 py-2 text-sm text-purple-darker">
      <span className="font-medium">Mockup · Compact horizontal.</span> All 5 QA
      categories on one row. Hover a cluster to see the AI&rsquo;s reasoning
      and evidence; weak scores pop, strong scores recede.
    </div>
  );
}

function TicketHeader({ ticket: t }: { ticket: typeof sampleTicket }) {
  return (
    <header className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-muted-foreground">
          {t.externalId}
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t.subject}
        </h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-green-lighter px-2 py-0.5 text-sm font-medium text-green-darker capitalize">
          {t.status}
        </span>
        <span className="inline-flex items-center rounded-md bg-yellow-lighter px-2 py-0.5 text-sm font-medium text-yellow-darker capitalize">
          {t.priority}
        </span>
        <span className="text-sm text-muted-foreground">
          {t.customer.name} &middot; {t.channel}
        </span>
      </div>
    </header>
  );
}

function QaStrip({
  evaluation: ev,
  msgIndex,
}: {
  evaluation: SampleEvaluation;
  msgIndex: Map<string, SampleMessage>;
}) {
  // weakest first — used for the headline hint
  const weakest = [...ev.categories]
    .filter((c) => severityFor(c) !== "quiet")
    .sort((a, b) => normalizedScore(a) - normalizedScore(b));

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-end gap-5">
          <OverallScore evaluation={ev} />
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">
              {ev.scorer.displayName}{" "}
              <span className="text-muted-foreground">
                &middot; {ev.aiConfidence}% confidence
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Scored {formatRelative(new Date(ev.scoredAt))}
              {weakest.length > 0 && (
                <>
                  {" "}
                  &middot;{" "}
                  <span className="text-foreground">
                    Coach on{" "}
                    {weakest
                      .slice(0, 2)
                      .map((c) => shortName(c.name))
                      .join(" + ")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CoachingButton evaluation={ev} />
          <Button size="sm" variant="outline" className="cursor-pointer">
            <Pencil className="size-3.5" />
            Edit scores
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 lg:grid-cols-5">
        {ev.categories.map((c) => (
          <CategoryCluster key={c.id} category={c} msgIndex={msgIndex} />
        ))}
      </div>
    </section>
  );
}

function OverallScore({ evaluation: ev }: { evaluation: SampleEvaluation }) {
  const tone =
    ev.overallScore >= 90
      ? "text-green-darker"
      : ev.overallScore >= 75
        ? "text-foreground"
        : ev.overallScore >= 60
          ? "text-yellow-darker"
          : "text-red-darker";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn("text-5xl font-semibold tracking-tight", tone)}>
        {ev.overallScore}
      </span>
      <span className="text-base text-muted-foreground">/ 100</span>
    </div>
  );
}

function CategoryCluster({
  category: c,
  msgIndex,
}: {
  category: SampleCategory;
  msgIndex: Map<string, SampleMessage>;
}) {
  const sev = severityFor(c);
  const max = SCALE_MAX[c.scaleType];

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full cursor-pointer flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-colors",
            cellClass[sev],
          )}
          style={{ flexGrow: c.weightPercent }}
        >
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "text-sm font-medium leading-tight",
                headlineClass[sev],
              )}
            >
              {c.name}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums",
                labelClass[sev],
              )}
            >
              {c.weightPercent}%
            </span>
          </div>

          <ScoreVisual category={c} severity={sev} max={max} />

          <div className="flex items-center justify-between">
            <span className={cn("text-sm font-semibold", headlineClass[sev])}>
              {c.scaleType === "binary"
                ? c.effectiveScore === 1
                  ? "Pass"
                  : "Fail"
                : `${c.effectiveScore} / ${max}`}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-sm opacity-0 transition-opacity group-hover:opacity-100",
                labelClass[sev],
              )}
            >
              evidence
              <ChevronRight className="size-3" />
            </span>
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[360px] space-y-3"
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {c.name}
            </span>
            <span className="text-sm text-muted-foreground">
              {c.weightPercent}% weight
              {c.isAutofail && (
                <span className="ml-1 text-red-darker">&middot; autofail</span>
              )}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{c.description}</p>
        </div>

        <div className="space-y-1.5 rounded-md bg-muted/50 p-2.5">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles className="size-3.5 text-blue-dark" />
            AI reasoning
          </div>
          <p className="text-sm text-muted-foreground">{c.aiReasoning}</p>
        </div>

        {c.highlightedMessageIds.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <MessageSquareQuote className="size-3.5 text-muted-foreground" />
              Evidence
            </div>
            <div className="space-y-1.5">
              {c.highlightedMessageIds.map((mid) => {
                const m = msgIndex.get(mid);
                if (!m) return null;
                return (
                  <blockquote
                    key={mid}
                    className="border-l-2 border-blue-light/60 pl-2 text-sm text-muted-foreground italic"
                  >
                    &ldquo;{truncate(m.body, 140)}&rdquo;
                    <div className="mt-0.5 text-xs not-italic">
                      &mdash; {m.authorName}
                    </div>
                  </blockquote>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          <Button size="sm" variant="outline" className="h-7 cursor-pointer">
            <Pencil className="size-3" />
            Adjust score
          </Button>
          <Button size="sm" variant="ghost" className="h-7 cursor-pointer">
            History
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ScoreVisual({
  category: c,
  severity,
  max,
}: {
  category: SampleCategory;
  severity: Severity;
  max: number;
}) {
  if (c.scaleType === "binary") {
    const pass = c.effectiveScore === 1;
    return (
      <div
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full",
          pass ? "bg-green-darker/15 text-green-darker" : "bg-red-darker/15 text-red-darker",
        )}
      >
        {pass ? <Check className="size-4" strokeWidth={2.5} /> : <X className="size-4" strokeWidth={2.5} />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < c.effectiveScore;
        return (
          <span
            key={i}
            className={cn(
              "block h-1.5 flex-1 rounded-full",
              filled ? dotFilledClass[severity] : "bg-foreground/10",
            )}
          />
        );
      })}
    </div>
  );
}

function CoachingButton({ evaluation: ev }: { evaluation: SampleEvaluation }) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Button size="sm" variant="ghost" className="cursor-pointer">
          <MessageSquareQuote className="size-3.5" />
          Coaching note
        </Button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="end" className="w-[380px] space-y-3">
        <div className="space-y-1.5">
          <div className="text-sm font-semibold text-foreground">
            What worked
          </div>
          <ul className="space-y-1.5">
            {ev.coaching.strengthPoints.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-green-dark" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5 border-t border-border pt-2.5">
          <div className="text-sm font-semibold text-foreground">
            To coach
          </div>
          <ul className="space-y-1.5">
            {ev.coaching.growthPoints.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-yellow-darker" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        {ev.coaching.exampleMessageIds.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Linked to {ev.coaching.exampleMessageIds.length} message
            {ev.coaching.exampleMessageIds.length === 1 ? "" : "s"} below.
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function Conversation({
  messages,
  categories,
}: {
  messages: SampleMessage[];
  categories: SampleCategory[];
}) {
  // Map message id -> categories that cite it as evidence.
  const evidenceMap = new Map<string, SampleCategory[]>();
  for (const c of categories) {
    for (const mid of c.highlightedMessageIds) {
      const list = evidenceMap.get(mid) ?? [];
      list.push(c);
      evidenceMap.set(mid, list);
    }
  }

  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Conversation
        </h2>
        <span className="text-sm text-muted-foreground">
          Evidence messages are marked.
        </span>
      </div>
      <ol className="space-y-2">
        {messages.map((m) => {
          const cites = evidenceMap.get(m.id) ?? [];
          const isAgent = m.role === "agent";
          return (
            <li
              key={m.id}
              className={cn(
                "rounded-lg border px-3.5 py-2.5",
                cites.length > 0
                  ? "border-blue-light/60 bg-blue-lighter/40"
                  : "border-border bg-card",
                isAgent ? "" : "border-l-2 border-l-purple-light/70",
              )}
            >
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">
                  {m.authorName}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {m.role}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {formatRelative(new Date(m.createdAt))}
                </span>
              </div>
              <p className="text-base text-foreground/90 whitespace-pre-line">
                {m.body}
              </p>
              {cites.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-blue-light/30 pt-1.5">
                  <span className="text-xs text-muted-foreground">
                    Cited as evidence for
                  </span>
                  {cites.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center rounded-md bg-blue-lighter px-1.5 py-0.5 text-xs font-medium text-blue-darker"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function normalizedScore(c: SampleCategory): number {
  if (c.scaleType === "binary") return c.effectiveScore;
  return c.effectiveScore / SCALE_MAX[c.scaleType];
}

function shortName(name: string): string {
  return name.split(/[\s&]/)[0].toLowerCase();
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}
