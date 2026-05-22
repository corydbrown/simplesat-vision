"use client";

import { ChannelPill } from "@/components/tickets/channel-pill";
import { PriorityPill } from "@/components/tickets/priority-pill";
import { StatusPill } from "@/components/tickets/status-pill";
import { SurveyStateCell } from "@/components/tickets/survey-state-cell";
import {
  CompanyPill,
  CustomerPill,
  ResponsePill,
  TeamMemberPill,
} from "@/components/shared/entity-pill";
import { TagList } from "@/components/shared/tag";
import type { TicketsRow } from "@/db/queries/tickets";
import { TICKET_FILTER_SPECS } from "@/lib/filters/specs/tickets";
import { formatDate, formatDuration } from "@/lib/format";
import type { Property } from "./types";

export const TICKET_PROPERTIES: Property<TicketsRow>[] = [
  {
    id: "external_id",
    label: "External ID",
    width: 130,
    group: "Identity",
    alwaysVisible: true,
    sortable: true,
    sortValue: (t) => t.helpdeskExternalId,
    filter: TICKET_FILTER_SPECS.external_id,
    cell: (t) => (
      <span className="font-mono text-xs text-muted-foreground">
        {t.helpdeskExternalId ?? "-"}
      </span>
    ),
    detail: (t) => (
      <span className="text-muted-foreground">
        {t.helpdeskExternalId ?? "-"}
      </span>
    ),
  },
  {
    id: "subject",
    label: "Subject",
    width: 320,
    group: "Identity",
    alwaysVisible: true,
    sortable: true,
    sortValue: (t) => t.subject,
    filter: TICKET_FILTER_SPECS.subject,
    cell: (t) => <span className="text-foreground">{t.subject}</span>,
  },
  {
    id: "status",
    label: "Status",
    width: 120,
    group: "State",
    defaultVisible: true,
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
    group: "State",
    defaultVisible: true,
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
    group: "Relations",
    defaultVisible: true,
    sortable: true,
    sortValue: (t) => t.customer?.name ?? null,
    cell: (t) =>
      t.customer ? (
        <CustomerPill id={t.customer.id} name={t.customer.name} />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "company",
    label: "Company",
    width: 180,
    group: "Relations",
    defaultVisible: true,
    sortable: true,
    sortValue: (t) => t.customer?.company ?? null,
    groupable: true,
    groupValue: (t) => t.customer?.company ?? null,
    nullGroupLabel: "No company",
    cell: (t) =>
      t.customer?.company ? (
        <CompanyPill name={t.customer.company} />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "assignee",
    label: "Assigned to",
    width: 200,
    group: "Relations",
    defaultVisible: true,
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
    group: "Source",
    defaultVisible: true,
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
    group: "Metadata",
    defaultVisible: true,
    cell: (t) => <TagList tags={t.tags} />,
  },
  {
    id: "resolution_time",
    label: "Resolution",
    width: 130,
    group: "Activity",
    defaultVisible: true,
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
    group: "Survey",
    defaultVisible: true,
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
    group: "Survey",
    defaultVisible: true,
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
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "created_at",
    label: "Created",
    width: 120,
    group: "Activity",
    defaultVisible: true,
    sortable: true,
    sortValue: (t) => t.createdAt,
    filter: TICKET_FILTER_SPECS.created_at,
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(t.createdAt)}
      </span>
    ),
  },
  {
    id: "closed_at",
    label: "Closed",
    width: 120,
    group: "Activity",
    defaultVisible: true,
    sortable: true,
    sortValue: (t) => t.closedAt,
    filter: TICKET_FILTER_SPECS.closed_at,
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(t.closedAt)}
      </span>
    ),
  },
  {
    id: "internal_id",
    label: "ID",
    width: 156,
    group: "Identity",
    defaultVisible: false,
    sortable: true,
    sortValue: (t) => t.id,
    cell: (t) => (
      <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
    ),
    detail: (t) => <span className="text-muted-foreground">{t.id}</span>,
  },
  {
    id: "helpdesk",
    label: "Helpdesk",
    width: 110,
    group: "Source",
    defaultVisible: false,
    sortable: true,
    sortValue: (t) => t.helpdesk,
    filter: TICKET_FILTER_SPECS.helpdesk,
    groupable: true,
    groupValue: (t) => t.helpdesk,
    groupLabel: (v) => <span className="capitalize">{v}</span>,
    cell: (t) => (
      <span className="capitalize text-muted-foreground">{t.helpdesk}</span>
    ),
  },
  {
    id: "first_response_at",
    label: "First response",
    width: 140,
    group: "Activity",
    defaultVisible: false,
    sortable: true,
    sortValue: (t) => t.firstResponseAt,
    filter: TICKET_FILTER_SPECS.first_response_at,
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(t.firstResponseAt)}
      </span>
    ),
  },
  {
    id: "solved_at",
    label: "Solved",
    width: 120,
    group: "Activity",
    defaultVisible: false,
    sortable: true,
    sortValue: (t) => t.solvedAt,
    filter: TICKET_FILTER_SPECS.solved_at,
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(t.solvedAt)}
      </span>
    ),
  },
];
