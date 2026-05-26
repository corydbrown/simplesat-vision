"use client";

import { Calendar, Hash, MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { formatTimelineDay } from "@/lib/format";
import type { QaRecentEvaluation } from "@/db/queries/team-members";
import type { Property } from "./types";

/** Property registry for evaluations embedded on a team-member detail page.
 *  Deliberately minimal — we only need the 5 columns the SVP-130 brief calls
 *  for; full evaluation listing (with filters/grouping) lives in /coaching. */
export const EVALUATION_PROPERTIES: Property<QaRecentEvaluation>[] = [
  {
    id: "scored_at",
    label: "Date",
    width: 140,
    icon: Calendar,
    sourceEntity: "Evaluation",
    alwaysVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (e) => e.scoredAtMs,
    cell: (e) => (
      <TimestampTooltip date={e.scoredAtMs}>
        <span className="text-muted-foreground">
          {formatTimelineDay(new Date(e.scoredAtMs))}
        </span>
      </TimestampTooltip>
    ),
  },
  {
    id: "ticket",
    label: "Ticket",
    width: 420,
    icon: MessageSquare,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (e) => e.ticketSubject,
    cell: (e) => (
      <span className="text-foreground">{e.ticketSubject}</span>
    ),
  },
  {
    id: "score",
    label: "Score",
    width: 90,
    icon: Hash,
    sourceEntity: "Evaluation",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (e) => e.overallScore,
    cell: (e) => <QaScoreBadge score={e.overallScore} status={e.status} />,
  },
  {
    id: "top_category",
    label: "Top category",
    width: 200,
    icon: ThumbsUp,
    sourceEntity: "Evaluation",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (e) => e.topCategory?.score ?? null,
    cell: (e) =>
      e.topCategory ? (
        <span className="text-muted-foreground">
          {e.topCategory.name}{" "}
          <span className="tabular-nums">
            ({Math.round(e.topCategory.score)})
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "lowest_category",
    label: "Lowest category",
    width: 200,
    icon: ThumbsDown,
    sourceEntity: "Evaluation",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (e) => e.lowestCategory?.score ?? null,
    cell: (e) =>
      e.lowestCategory ? (
        <span className="text-muted-foreground">
          {e.lowestCategory.name}{" "}
          <span className="tabular-nums">
            ({Math.round(e.lowestCategory.score)})
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
];
