import Link from "next/link";
import { Bot, CheckCircle2, User } from "lucide-react";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { TeamMemberPill } from "@/components/shared/entity-pill";
import { VersionPicker } from "@/components/coaching/version-picker";
import { RescoreWithPicker } from "@/components/coaching/rescore-with-picker";
import { cn } from "@/lib/utils";
import type { ScorecardAppliesTo } from "@/db/schema";
import type { EvaluationVersionRow } from "@/db/queries/evaluations";
import type { LiveScorecardPickerRow } from "@/db/queries/scorecards";

/** SVP-274: tri-card switcher rendered at the top of the evaluation detail
 *  page. One card per target (AI / Human / Resolution) that has at least
 *  one evaluation on this ticket. The card whose group contains the URL
 *  eval id is highlighted; the existing CoachingTicket surface below
 *  renders that eval. Clicking a non-active card navigates to that group's
 *  latest eval id.
 *
 *  Each card owns its own VersionPicker (filtered to its target's versions)
 *  and RescoreWithPicker (filtered to scorecards matching its applies_to),
 *  so re-scoring one target doesn't touch the others. */
export function EvalTargetCards({
  ticketId,
  activeEvaluationId,
  versions,
  liveScorecards,
  defaultScorecardId,
}: {
  ticketId: string;
  /** Eval whose data populates the coaching surface below. Matches one of
   *  the rows in `versions`. */
  activeEvaluationId: string;
  /** Every eval for this ticket, ordered newest-version-first per scorecard
   *  (the shape `listEvaluationsForTicket` returns). */
  versions: EvaluationVersionRow[];
  liveScorecards: LiveScorecardPickerRow[];
  defaultScorecardId: string | null;
}) {
  const groups = groupByAppliesTo(versions);
  // Render order: Human first (most familiar), AI second (new), Resolution
  // third (composite). Skip empty groups.
  const ordered: ScorecardAppliesTo[] = ["human", "ai", "resolution"];
  const visible = ordered.filter((t) => groups[t].length > 0);

  if (visible.length === 0) return null;

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((target) => {
        const groupVersions = groups[target];
        const isActive = groupVersions.some((v) => v.id === activeEvaluationId);
        // The latest row per target = head of its array (the query orders
        // newest-version-first). Active card uses the URL eval; non-active
        // cards always link to their own latest.
        const head = isActive
          ? (groupVersions.find((v) => v.id === activeEvaluationId) ??
            groupVersions[0])
          : groupVersions[0];
        const targetScorecards = liveScorecards.filter(
          (s) => s.appliesTo === target,
        );
        return (
          <Card
            key={target}
            ticketId={ticketId}
            target={target}
            head={head}
            groupVersions={groupVersions}
            targetScorecards={targetScorecards}
            defaultScorecardId={defaultScorecardId}
            isActive={isActive}
          />
        );
      })}
    </div>
  );
}

function Card({
  ticketId,
  target,
  head,
  groupVersions,
  targetScorecards,
  defaultScorecardId,
  isActive,
}: {
  ticketId: string;
  target: ScorecardAppliesTo;
  head: EvaluationVersionRow;
  groupVersions: EvaluationVersionRow[];
  targetScorecards: LiveScorecardPickerRow[];
  defaultScorecardId: string | null;
  isActive: boolean;
}) {
  const chip = TARGET_CHIP[target];
  const ChipIcon = chip.icon;

  // Wrap the whole inactive card in a Link so clicking anywhere on it
  // switches to that target's eval. Interactive children (VersionPicker,
  // RescoreWithPicker) stopPropagation via their own click handlers /
  // Radix triggers, so they don't accidentally navigate.
  const inner = (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-lg border bg-card p-3 transition-colors",
        isActive
          ? "border-primary/60 bg-primary/5 shadow-sm"
          : "border-border hover:border-foreground/20 hover:bg-accent/30",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-sm font-medium",
            chip.bg,
            chip.text,
          )}
        >
          <ChipIcon size={12} />
          {chip.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-base text-foreground">
          {head.scorecardName}
        </span>
        <QaScoreBadge
          score={head.overallScore}
          status={head.status}
          size="sm"
        />
      </div>
      <div className="flex items-center gap-2 text-base text-muted-foreground">
        <span className="shrink-0">Scored:</span>
        {target === "resolution" ? (
          <span className="text-foreground">Customer outcome</span>
        ) : head.scoredTeamMember ? (
          <TeamMemberPill
            id={head.scoredTeamMember.id}
            name={head.scoredTeamMember.name}
            avatarColor={head.scoredTeamMember.avatarColor}
            size="sm"
          />
        ) : (
          <span className="italic">
            {target === "ai" ? "AI agent" : "—"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-base text-muted-foreground">
        <span className="shrink-0">Model:</span>
        <span className="truncate font-mono text-sm">
          {head.aiModel || "—"}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <VersionPicker
          currentEvaluationId={head.id}
          versions={groupVersions}
          size="sm"
        />
        <RescoreWithPicker
          ticketId={ticketId}
          scorecards={targetScorecards}
          currentScorecardId={head.scorecardId}
          defaultScorecardId={defaultScorecardId}
        />
      </div>
    </div>
  );

  if (isActive) return inner;
  return (
    <Link
      href={`/evaluations/${head.id}`}
      className="block cursor-pointer no-underline"
      aria-label={`Switch to ${chip.label} evaluation`}
    >
      {inner}
    </Link>
  );
}

function groupByAppliesTo(
  versions: EvaluationVersionRow[],
): Record<ScorecardAppliesTo, EvaluationVersionRow[]> {
  const out: Record<ScorecardAppliesTo, EvaluationVersionRow[]> = {
    human: [],
    ai: [],
    resolution: [],
  };
  for (const v of versions) out[v.appliesTo].push(v);
  return out;
}

const TARGET_CHIP: Record<
  ScorecardAppliesTo,
  {
    label: string;
    icon: typeof User;
    bg: string;
    text: string;
  }
> = {
  human: {
    label: "Human",
    icon: User,
    bg: "bg-blue-lighter",
    text: "text-blue-darker",
  },
  ai: {
    label: "AI",
    icon: Bot,
    bg: "bg-purple-lighter",
    text: "text-purple-darker",
  },
  resolution: {
    label: "Resolution",
    icon: CheckCircle2,
    bg: "bg-green-lighter",
    text: "text-green-darker",
  },
};
