"use client";

import {
  Activity,
  Bot,
  Briefcase,
  Calendar,
  Cpu,
  Gauge,
  Hash,
  ListChecks,
  MessageSquare,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { TeamMemberPill } from "@/components/shared/entity-pill";
import { TeamPill } from "@/components/shared/team-pill";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";
import { providerLabel } from "@/lib/team-members/provider-display";
import { formatNumber, formatRelative } from "@/lib/format";
import { QA_BUCKET_CLASSES, qaScoreBucket } from "@/lib/qa/score-color";
import type { AgentRosterRow } from "@/db/queries/team-members";
import type { Property } from "./types";

/** "Human" / "AI agent" kind chip — the headline visual distinction on the
 *  roster. Uses production hue tokens so the chip theme-flips correctly. */
function KindChip({ kind }: { kind: AgentRosterRow["kind"] }) {
  if (kind === "ai_agent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-lighter px-2 py-0.5 text-sm font-medium text-purple-darker">
        <Bot size={12} />
        AI agent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-grey-lighter px-2 py-0.5 text-sm font-medium text-grey-darker">
      <User size={12} />
      Human
    </span>
  );
}

/** 0-100 score badge that reuses the existing QA score bucket palette so the
 *  response-score and eval-score columns read on the same visual axis. */
function ScoreBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground/40">—</span>;
  const rounded = Math.round(value);
  const bucket = qaScoreBucket(rounded);
  const classes = QA_BUCKET_CLASSES[bucket];
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-sm font-medium tabular-nums ${classes.bg} ${classes.text}`}
    >
      {rounded}
    </span>
  );
}

/** Signed gap between response score and eval score. Positive = customers
 *  happier than QA; negative = QA stricter than customers. Both null → em-dash.
 *  Color comes from the magnitude of the gap (close to zero = neutral). */
function GapCell({
  responseScore,
  evalScore,
}: {
  responseScore: number | null;
  evalScore: number | null;
}) {
  if (responseScore == null || evalScore == null) {
    return <span className="text-muted-foreground/40">—</span>;
  }
  const gap = responseScore - evalScore;
  const rounded = Math.round(gap);
  const tone =
    Math.abs(rounded) < 5
      ? "text-muted-foreground"
      : rounded > 0
        ? "text-green-dark"
        : "text-red-dark";
  const sign = rounded > 0 ? "+" : "";
  return (
    <span className={`tabular-nums ${tone}`}>
      {sign}
      {rounded}
    </span>
  );
}

const PROPERTIES: Property<AgentRosterRow>[] = [
  {
    id: "name",
    label: "Name",
    width: 220,
    icon: User,
    sourceEntity: "Team member",
    alwaysVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (a) => a.name,
    cell: (a) => (
      <TeamMemberPill
        id={a.id}
        name={a.name}
        avatarColor={a.avatarColor}
        avatarUrl={a.avatarUrl}
      />
    ),
  },
  {
    id: "kind",
    label: "Kind",
    width: 130,
    icon: Sparkles,
    sourceEntity: "Team member",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (a) => a.kind,
    groupable: true,
    groupValue: (a) => a.kind,
    groupLabel: (v) => <KindChip kind={v as AgentRosterRow["kind"]} />,
    cell: (a) => <KindChip kind={a.kind} />,
  },
  {
    id: "role",
    label: "Role",
    width: 170,
    icon: Briefcase,
    sourceEntity: "Team member",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (a) => a.role,
    groupable: true,
    groupValue: (a) => a.role,
    cell: (a) => <span className="text-muted-foreground">{a.role}</span>,
  },
  {
    id: "team",
    label: "Team",
    width: 130,
    icon: Users,
    sourceEntity: "Team member",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (a) => a.team,
    groupable: true,
    groupValue: (a) => a.team,
    groupLabel: (v) => <TeamPill team={v} />,
    cell: (a) => <TeamPill team={a.team} />,
  },
  {
    id: "provider",
    label: "Provider",
    width: 150,
    icon: Bot,
    sourceEntity: "Team member",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (a) => a.provider,
    cell: (a) =>
      a.kind === "ai_agent" ? (
        <span className="text-muted-foreground">
          {providerLabel(a.provider)}
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "model",
    label: "Model",
    width: 140,
    icon: Cpu,
    sourceEntity: "Team member",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (a) => a.model,
    cell: (a) =>
      a.kind === "ai_agent" && a.model ? (
        <span className="font-mono text-sm text-muted-foreground">
          {a.model}
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "response_score",
    label: "Response score",
    width: 150,
    icon: MessageSquare,
    sourceEntity: "Responses",
    defaultVisible: true,
    kind: "component",
    align: "right",
    sortable: true,
    sortValue: (a) => a.responseScore,
    cell: (a) => <ScoreBadge value={a.responseScore} />,
  },
  {
    id: "eval_score",
    label: "Eval score",
    width: 140,
    icon: Gauge,
    sourceEntity: "Evaluations",
    defaultVisible: true,
    kind: "component",
    align: "right",
    sortable: true,
    sortValue: (a) => a.evalScore,
    cell: (a) => <ScoreBadge value={a.evalScore} />,
  },
  {
    id: "gap",
    label: "Gap",
    width: 90,
    icon: Activity,
    sourceEntity: "Evaluations",
    defaultVisible: true,
    kind: "component",
    align: "right",
    sortable: true,
    sortValue: (a) =>
      a.responseScore != null && a.evalScore != null
        ? a.responseScore - a.evalScore
        : null,
    cell: (a) => (
      <GapCell responseScore={a.responseScore} evalScore={a.evalScore} />
    ),
  },
  {
    id: "open_evals",
    label: "Open evals",
    width: 120,
    icon: ListChecks,
    sourceEntity: "Evaluations",
    defaultVisible: true,
    kind: "text",
    align: "right",
    sortable: true,
    sortValue: (a) => a.openEvals,
    cell: (a) =>
      a.openEvals > 0 ? (
        <span className="tabular-nums">{formatNumber(a.openEvals)}</span>
      ) : (
        <span className="tabular-nums text-muted-foreground/40">0</span>
      ),
  },
  {
    id: "last_evaluated_at",
    label: "Last evaluated",
    width: 150,
    icon: Calendar,
    sourceEntity: "Evaluations",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (a) => a.lastEvaluatedAtMs,
    cell: (a) =>
      a.lastEvaluatedAtMs != null ? (
        <TimestampTooltip date={a.lastEvaluatedAtMs}>
          <span className="text-muted-foreground">
            {formatRelative(a.lastEvaluatedAtMs)}
          </span>
        </TimestampTooltip>
      ) : (
        <span className="text-muted-foreground/40">Never</span>
      ),
  },
  {
    id: "deployed_at",
    label: "Deployed",
    width: 140,
    icon: Calendar,
    sourceEntity: "Team member",
    defaultVisible: false,
    kind: "component",
    sortable: true,
    sortValue: (a) => (a.deployedAt ? a.deployedAt.getTime() : null),
    cell: (a) =>
      a.kind === "ai_agent" && a.deployedAt ? (
        <TimestampTooltip date={a.deployedAt.getTime()}>
          <span className="text-muted-foreground">
            {formatRelative(a.deployedAt.getTime())}
          </span>
        </TimestampTooltip>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "id",
    label: "Internal ID",
    width: 156,
    icon: Hash,
    sourceEntity: "Team member",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (a) => a.id,
    cell: (a) => (
      <span className="font-mono text-xs text-muted-foreground">{a.id}</span>
    ),
    detail: (a) => <span className="text-muted-foreground">{a.id}</span>,
  },
];

export const AGENT_PROPERTIES = PROPERTIES;
