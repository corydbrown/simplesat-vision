import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/** Optional period-over-period change displayed alongside the main value.
 *  `direction` decides the tone (good/bad/neutral) — higher-is-better metrics
 *  should map a positive delta to "good"; for lower-is-better metrics, invert
 *  at the call site. */
export type StatCardDelta = {
  /** Pre-formatted text, e.g. "+2.4" or "-0.3 stars". */
  label: string;
  direction: "good" | "bad" | "neutral";
  /** Optional secondary line, e.g. "vs. prior 30 days". */
  hint?: string;
};

export function StatCard({
  label,
  value,
  tone,
  delta,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  /** Period-over-period change line. Omit for tiles without comparison. */
  delta?: StatCardDelta;
  /** Static subtitle shown when no delta exists (e.g. "Needs human reviews"). */
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? "text-foreground"}`}
      >
        {value}
      </div>
      {delta ? <DeltaRow delta={delta} /> : null}
      {!delta && hint ? (
        <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

function DeltaRow({ delta }: { delta: StatCardDelta }) {
  const Icon =
    delta.direction === "good"
      ? ArrowUpRight
      : delta.direction === "bad"
        ? ArrowDownRight
        : Minus;
  const toneClass =
    delta.direction === "good"
      ? "text-green-dark"
      : delta.direction === "bad"
        ? "text-red-dark"
        : "text-muted-foreground";
  return (
    <div className="mt-1 flex items-center gap-1 text-sm">
      <Icon size={14} className={toneClass} />
      <span className={`${toneClass} tabular-nums`}>{delta.label}</span>
      {delta.hint ? (
        <span className="text-muted-foreground">{delta.hint}</span>
      ) : null}
    </div>
  );
}
