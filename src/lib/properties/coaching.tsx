"use client";

import {
  Calendar,
  CalendarClock,
  CircleDot,
  ClipboardCheck,
  Gauge,
  Hash,
  Inbox,
  ShieldAlert,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { EvaluationStatusPill } from "@/components/coaching/evaluation-status-pill";
import {
  TeamMemberPill,
  TicketPill,
} from "@/components/shared/entity-pill";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import type { EvaluationsRow } from "@/db/queries/evaluations";
import type { QaEvaluationStatus } from "@/db/schema";
import { COACHING_FILTER_SPECS } from "@/lib/filters/specs/coaching";
import { formatDate } from "@/lib/format";
import {
  QA_BUCKET_LABEL,
  qaScoreBucket,
  type QaScoreBucket,
} from "@/lib/qa/score-color";
import type { Property } from "./types";

const STATUS_LABEL: Record<QaEvaluationStatus, string> = {
  ai_scored: "AI scored",
  edited: "Edited",
  contested: "Contested",
  invalidated: "Invalidated",
  finalized: "Finalized",
};

export const COACHING_PROPERTIES: Property<EvaluationsRow>[] = [
  {
    id: "ticket",
    label: "Ticket",
    width: 320,
    icon: Inbox,
    sourceEntity: "Ticket",
    alwaysVisible: true,
    sortable: true,
    sortValue: (e) => e.ticket?.subject ?? null,
    cell: (e) =>
      e.ticket ? (
        <TicketPill
          id={e.ticket.id}
          externalId={e.ticket.helpdeskExternalId}
          subject={e.ticket.subject}
        />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "overall_score",
    label: "Score",
    width: 110,
    icon: Gauge,
    sourceEntity: "Coaching",
    alwaysVisible: true,
    align: "right",
    // Worst-first is the actionable default for managers triaging the
    // review queue — mirrors the "Needs my attention" saved view sort.
    sortable: true,
    sortValue: (e) => e.overallScore,
    filter: COACHING_FILTER_SPECS.overall_score,
    groupable: true,
    groupValue: (e) => qaScoreBucket(e.overallScore, e.status),
    groupLabel: (v) => QA_BUCKET_LABEL[v as QaScoreBucket] ?? v,
    nullGroupLabel: QA_BUCKET_LABEL["not-scored"],
    cell: (e) => <QaScoreBadge score={e.overallScore} status={e.status} />,
  },
  {
    id: "status",
    label: "Status",
    width: 130,
    icon: CircleDot,
    sourceEntity: "Coaching",
    defaultVisible: true,
    sortable: true,
    sortValue: (e) => e.status,
    filter: COACHING_FILTER_SPECS.status,
    groupable: true,
    groupValue: (e) => e.status,
    groupLabel: (v) => (
      <EvaluationStatusPill status={v as QaEvaluationStatus} />
    ),
    cell: (e) => <EvaluationStatusPill status={e.status} />,
  },
  {
    id: "scored_team_member",
    label: "Scored agent",
    width: 200,
    icon: UserCircle2,
    sourceEntity: "Team member",
    defaultVisible: true,
    sortable: true,
    sortValue: (e) => e.scoredTeamMember?.name ?? null,
    filter: COACHING_FILTER_SPECS.scored_team_member,
    groupable: true,
    groupValue: (e) => e.scoredTeamMember?.name ?? null,
    nullGroupLabel: "Unassigned",
    cell: (e) =>
      e.scoredTeamMember ? (
        <TeamMemberPill
          id={e.scoredTeamMember.id}
          name={e.scoredTeamMember.name}
          avatarColor={e.scoredTeamMember.avatarColor}
        />
      ) : (
        <span className="text-muted-foreground">Unassigned</span>
      ),
  },
  {
    id: "scorecard",
    label: "Scorecard",
    width: 180,
    icon: ClipboardCheck,
    sourceEntity: "Coaching",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (e) => e.scorecard?.name ?? null,
    filter: COACHING_FILTER_SPECS.scorecard,
    groupable: true,
    groupValue: (e) => e.scorecard?.name ?? null,
    cell: (e) =>
      e.scorecard ? (
        <span className="text-muted-foreground">{e.scorecard.name}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "auto_failed",
    label: "Auto-failed",
    width: 120,
    icon: ShieldAlert,
    sourceEntity: "Coaching",
    defaultVisible: true,
    sortable: true,
    sortValue: (e) => (e.autoFailed ? 1 : 0),
    filter: COACHING_FILTER_SPECS.auto_failed,
    cell: (e) =>
      e.autoFailed ? (
        <span className="inline-flex items-center rounded-full bg-red-lighter px-2 py-0.5 text-sm font-medium text-red-darker">
          Auto-failed
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "ai_confidence",
    label: "AI confidence",
    width: 130,
    icon: Sparkles,
    sourceEntity: "Coaching",
    defaultVisible: false,
    kind: "text",
    align: "right",
    sortable: true,
    sortValue: (e) => e.aiConfidence,
    filter: COACHING_FILTER_SPECS.ai_confidence,
    cell: (e) => (
      <span className="tabular-nums text-muted-foreground">
        {e.aiConfidence}%
      </span>
    ),
  },
  {
    id: "scored_at",
    label: "Scored",
    width: 130,
    icon: Calendar,
    sourceEntity: "Coaching",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (e) => e.scoredAt,
    filter: COACHING_FILTER_SPECS.scored_at,
    cell: (e) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(e.scoredAt)}
      </span>
    ),
  },
  {
    id: "edited_at",
    label: "Edited",
    width: 130,
    icon: CalendarClock,
    sourceEntity: "Coaching",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (e) => e.editedAt,
    filter: COACHING_FILTER_SPECS.edited_at,
    cell: (e) =>
      e.editedAt ? (
        <span className="tabular-nums text-muted-foreground">
          {formatDate(e.editedAt)}
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "internal_id",
    label: "ID",
    width: 156,
    icon: Hash,
    sourceEntity: "Coaching",
    defaultVisible: false,
    kind: "text",
    sortable: false,
    cell: (e) => (
      <span className="font-mono text-xs text-muted-foreground">{e.id}</span>
    ),
    detail: (e) => <span className="text-muted-foreground">{e.id}</span>,
  },
];

export { STATUS_LABEL as COACHING_STATUS_LABEL };

/** Module-level helper for EntityTable's `rowHref` prop. Defined here (rather
 *  than inline in the page) so the server→client component boundary sees a
 *  module reference instead of a closure — Next 16 RSC rejects ad-hoc
 *  functions but allows references into client modules. */
export function coachingRowHref(row: EvaluationsRow): string {
  return `/coaching/${row.id}`;
}
