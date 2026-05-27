"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronUp,
  CircleDot,
  ClipboardCheck,
  Clock,
  Flag,
  Gauge,
  Hash,
  Headphones,
  Hourglass,
  Inbox,
  MessageCircle,
  Sparkles,
  Star,
  Tag as TagIcon,
  Timer,
  Type,
  User,
  UserCircle2,
} from "lucide-react";
import { ChannelPill } from "@/components/tickets/channel-pill";
import { PriorityPill } from "@/components/tickets/priority-pill";
import { SignalsCell } from "@/components/tickets/signals-cell";
import { StatusPill } from "@/components/tickets/status-pill";
import { SurveyStateCell } from "@/components/tickets/survey-state-cell";
import {
  CompanyPill,
  CustomerPill,
  ResponsePill,
  TeamMemberPill,
} from "@/components/shared/entity-pill";
import { QaScoreBadge } from "@/components/shared/qa-score-badge";
import { TagList } from "@/components/shared/tag";
import type { TicketsRow } from "@/db/queries/tickets";
import { TICKET_FILTER_SPECS } from "@/lib/filters/specs/tickets";
import { formatDate, formatDuration } from "@/lib/format";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";
import {
  QA_BUCKET_LABEL,
  qaScoreBucket,
  type QaScoreBucket,
} from "@/lib/qa/score-color";
import type { Property } from "./types";

export const TICKET_PROPERTIES: Property<TicketsRow>[] = [
  {
    id: "external_id",
    label: "External ID",
    width: 130,
    icon: Hash,
    sourceEntity: "Ticket",
    alwaysVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (t) => t.externalId,
    filter: TICKET_FILTER_SPECS.external_id,
    cell: (t) => (
      <span className="font-mono text-xs text-muted-foreground">
        {t.externalId ?? "-"}
      </span>
    ),
    detail: (t) => (
      <span className="text-muted-foreground">
        {t.externalId ?? "-"}
      </span>
    ),
  },
  {
    id: "subject",
    label: "Subject",
    width: 320,
    icon: Type,
    sourceEntity: "Ticket",
    alwaysVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (t) => t.subject,
    filter: TICKET_FILTER_SPECS.subject,
    cell: (t) => <span className="text-foreground">{t.subject}</span>,
  },
  {
    id: "status",
    label: "Status",
    width: 120,
    icon: CircleDot,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (t) => t.status,
    filter: TICKET_FILTER_SPECS.status,
    groupable: true,
    groupValue: (t) => t.status,
    groupLabel: (v) => <StatusPill status={v as TicketsRow["status"]} />,
    cell: (t) => <StatusPill status={t.status} />,
  },
  {
    id: "priority",
    label: "Priority",
    width: 110,
    icon: Flag,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (t) => t.priority,
    filter: TICKET_FILTER_SPECS.priority,
    groupable: true,
    groupValue: (t) => t.priority,
    groupLabel: (v) => <PriorityPill priority={v as TicketsRow["priority"]} />,
    cell: (t) => <PriorityPill priority={t.priority} />,
  },
  {
    id: "customer",
    label: "Customer",
    width: 200,
    icon: User,
    sourceEntity: "Customer",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (t) => t.customer?.name ?? null,
    cell: (t) =>
      t.customer ? (
        <CustomerPill id={t.customer.id} name={t.customer.name} />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "organization",
    label: "Organization",
    width: 180,
    icon: Building2,
    sourceEntity: "Customer",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (t) => t.customer?.organization ?? null,
    groupable: true,
    groupValue: (t) => t.customer?.organization ?? null,
    nullGroupLabel: "No organization",
    cell: (t) =>
      t.customer?.organization ? (
        <CompanyPill name={t.customer.organization} />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "assignee",
    label: "Assigned to",
    width: 200,
    icon: UserCircle2,
    sourceEntity: "Team member",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (t) => t.assignee?.name ?? null,
    groupable: true,
    groupValue: (t) => t.assignee?.name ?? null,
    nullGroupLabel: "Unassigned",
    cell: (t) =>
      t.assignee ? (
        <TeamMemberPill
          id={t.assignee.id}
          name={t.assignee.name}
          avatarColor={t.assignee.avatarColor}
        />
      ) : (
        <span className="text-muted-foreground">Unassigned</span>
      ),
  },
  {
    id: "channel",
    label: "Channel",
    width: 120,
    icon: Inbox,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (t) => t.channel,
    filter: TICKET_FILTER_SPECS.channel,
    groupable: true,
    groupValue: (t) => t.channel,
    groupLabel: (v) => <ChannelPill channel={v as TicketsRow["channel"]} />,
    cell: (t) => <ChannelPill channel={t.channel} />,
  },
  {
    id: "tags",
    label: "Tags",
    width: 200,
    icon: TagIcon,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "component",
    filter: TICKET_FILTER_SPECS.tags,
    cell: (t) => <TagList tags={t.tags} />,
  },
  {
    id: "resolution_time",
    label: "Resolution",
    width: 130,
    icon: Timer,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "text",
    align: "right",
    sortable: true,
    sortValue: (t) =>
      t.solvedAt ? t.solvedAt.getTime() - t.createdAt.getTime() : null,
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDuration(t.createdAt, t.solvedAt)}
      </span>
    ),
  },
  {
    id: "survey_state",
    label: "Survey state",
    width: 160,
    icon: ClipboardCheck,
    sourceEntity: "Response",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (t) =>
      // Mirror the SQL CASE ordering in tickets.ts; keep the two in sync.
      t.response
        ? "1_responded"
        : t.surveySentAt
          ? "2_sent_no_reply"
          : t.surveyNotSentReason
            ? "3_not_fired"
            : !t.surveyEligible
              ? "4_skipped"
              : "5_pending",
    cell: (t) => <SurveyStateCell ticket={t} />,
  },
  {
    id: "response",
    label: "Response",
    width: 110,
    icon: Star,
    sourceEntity: "Response",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (t) => t.response?.rating ?? null,
    cell: (t) =>
      t.response ? (
        <ResponsePill
          id={t.response.id}
          rating={t.response.rating}
          scale={t.response.scale}
        />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "qa_score",
    label: "QA",
    width: 80,
    icon: Gauge,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "component",
    // Lower scores are the actionable case ("which tickets need review?"), so
    // ascending order is the useful default direction even though the column
    // shows a 0-100 value. The "Needs QA review" saved view applies asc
    // explicitly; client-side click-to-sort starts from neutral.
    sortable: true,
    sortValue: (t) => t.qaScore,
    filter: TICKET_FILTER_SPECS.qa_score,
    groupable: true,
    groupValue: (t) => qaScoreBucket(t.qaScore, t.qaStatus),
    groupLabel: (v) => QA_BUCKET_LABEL[v as QaScoreBucket] ?? v,
    nullGroupLabel: QA_BUCKET_LABEL["not-scored"],
    cell: (t) => <QaScoreBadge score={t.qaScore} status={t.qaStatus} />,
  },
  {
    // Aggregate icon-chip column that surfaces every triggered ticket-event
    // signal on a row. Individual signals also exist as filter-only columns
    // below so each is filterable in its own right; this column is the
    // at-a-glance visual.
    id: "signals",
    label: "Signals",
    width: 130,
    icon: Sparkles,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "component",
    cell: (t) => <SignalsCell signals={t.signals} />,
  },
  // -- Ticket-event signals (filter-only columns) -------------------------
  // These properties exist so each signal is independently filterable via
  // the Filter chooser. The visible "Signals" column above renders the chips;
  // these columns stay hidden by default but can be toggled on for cases
  // where a user wants the raw numeric column.
  {
    id: "had_transfer",
    label: "Had transfer",
    width: 130,
    icon: ArrowRightLeft,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    filter: TICKET_FILTER_SPECS.had_transfer,
    cell: (t) => (
      <span className="text-muted-foreground">
        {t.signals.hadTransfer ? "Yes" : "No"}
      </span>
    ),
  },
  {
    id: "reassignment_count",
    label: "Reassignments",
    width: 130,
    icon: ArrowRightLeft,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    align: "right",
    filter: TICKET_FILTER_SPECS.reassignment_count,
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {t.signals.reassignmentCount}
      </span>
    ),
  },
  {
    id: "queue_wait_hours",
    label: "Queue wait (hrs)",
    width: 140,
    icon: Clock,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    align: "right",
    filter: TICKET_FILTER_SPECS.queue_wait_hours,
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {t.signals.queueWaitHours == null
          ? "—"
          : t.signals.queueWaitHours.toFixed(1)}
      </span>
    ),
  },
  {
    id: "sla_breached",
    label: "SLA breached",
    width: 130,
    icon: AlertTriangle,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    filter: TICKET_FILTER_SPECS.sla_breached,
    cell: (t) => (
      <span className="text-muted-foreground">
        {t.signals.slaBreached ? "Yes" : "No"}
      </span>
    ),
  },
  {
    id: "escalated",
    label: "Escalated",
    width: 110,
    icon: ChevronUp,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    filter: TICKET_FILTER_SPECS.escalated,
    cell: (t) => (
      <span className="text-muted-foreground">
        {t.signals.escalated ? "Yes" : "No"}
      </span>
    ),
  },
  {
    id: "ai_handoff",
    label: "AI handoff",
    width: 110,
    icon: Bot,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    filter: TICKET_FILTER_SPECS.ai_handoff,
    cell: (t) => (
      <span className="text-muted-foreground">
        {t.signals.aiHandoff ? "Yes" : "No"}
      </span>
    ),
  },
  {
    id: "customer_reply_count",
    label: "Customer replies",
    width: 140,
    icon: MessageCircle,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    align: "right",
    filter: TICKET_FILTER_SPECS.customer_reply_count,
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {t.signals.customerReplyCount}
      </span>
    ),
  },
  {
    id: "longest_idle_hours",
    label: "Longest idle (hrs)",
    width: 150,
    icon: Hourglass,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    align: "right",
    filter: TICKET_FILTER_SPECS.longest_idle_hours,
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {t.signals.longestIdleHours == null
          ? "—"
          : t.signals.longestIdleHours.toFixed(1)}
      </span>
    ),
  },
  {
    id: "created_at",
    label: "Created",
    width: 120,
    icon: Calendar,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (t) => t.createdAt,
    filter: TICKET_FILTER_SPECS.created_at,
    cell: (t) => (
      <TimestampTooltip date={t.createdAt}>
        <span className="tabular-nums text-muted-foreground">
          {formatDate(t.createdAt)}
        </span>
      </TimestampTooltip>
    ),
  },
  {
    id: "closed_at",
    label: "Closed",
    width: 120,
    icon: CalendarCheck,
    sourceEntity: "Ticket",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (t) => t.closedAt,
    filter: TICKET_FILTER_SPECS.closed_at,
    cell: (t) => (
      <TimestampTooltip date={t.closedAt}>
        <span className="tabular-nums text-muted-foreground">
          {formatDate(t.closedAt)}
        </span>
      </TimestampTooltip>
    ),
  },
  {
    id: "internal_id",
    label: "ID",
    width: 156,
    icon: Hash,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (t) => t.id,
    cell: (t) => (
      <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
    ),
    detail: (t) => <span className="text-muted-foreground">{t.id}</span>,
  },
  {
    id: "source",
    label: "Source",
    width: 110,
    icon: Headphones,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (t) => t.source,
    filter: TICKET_FILTER_SPECS.source,
    groupable: true,
    groupValue: (t) => t.source,
    groupLabel: (v) => <span className="capitalize">{v}</span>,
    cell: (t) => (
      <span className="capitalize text-muted-foreground">{t.source}</span>
    ),
  },
  {
    id: "first_response_at",
    label: "First response",
    width: 140,
    icon: CalendarClock,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (t) => t.firstResponseAt,
    filter: TICKET_FILTER_SPECS.first_response_at,
    cell: (t) => (
      <TimestampTooltip date={t.firstResponseAt}>
        <span className="tabular-nums text-muted-foreground">
          {formatDate(t.firstResponseAt)}
        </span>
      </TimestampTooltip>
    ),
  },
  {
    id: "solved_at",
    label: "Solved",
    width: 120,
    icon: CheckCircle2,
    sourceEntity: "Ticket",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (t) => t.solvedAt,
    filter: TICKET_FILTER_SPECS.solved_at,
    cell: (t) => (
      <TimestampTooltip date={t.solvedAt}>
        <span className="tabular-nums text-muted-foreground">
          {formatDate(t.solvedAt)}
        </span>
      </TimestampTooltip>
    ),
  },
];
