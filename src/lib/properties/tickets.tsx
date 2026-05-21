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
import {
  DATE_OPS,
  ENUM_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import { formatDate, formatDuration } from "@/lib/format";
import type { Property } from "./types";

const TICKET_STATUS = ["open", "pending", "solved", "closed"];
const TICKET_PRIORITY = ["low", "normal", "high", "urgent"];
const TICKET_CHANNEL = ["email", "chat", "phone", "social"];
const TICKET_HELPDESK = ["zendesk", "gladly", "gorgias", "intercom"];

export const TICKET_PROPERTIES: Property<TicketsRow>[] = [
  {
    id: "external_id",
    label: "External ID",
    width: 130,
    group: "Identity",
    alwaysVisible: true,
    sortable: false,
    filter: { dataType: "string", ops: STRING_OPS },
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
    filter: { dataType: "string", ops: STRING_OPS },
    cell: (t) => <span className="text-foreground">{t.subject}</span>,
  },
  {
    id: "status",
    label: "Status",
    width: 120,
    group: "State",
    defaultVisible: true,
    sortable: true,
    filter: { dataType: "enum", ops: ENUM_OPS, enumValues: TICKET_STATUS },
    cell: (t) => <StatusPill status={t.status} />,
  },
  {
    id: "priority",
    label: "Priority",
    width: 110,
    group: "State",
    defaultVisible: true,
    sortable: true,
    filter: { dataType: "enum", ops: ENUM_OPS, enumValues: TICKET_PRIORITY },
    cell: (t) => <PriorityPill priority={t.priority} />,
  },
  {
    id: "customer",
    label: "Customer",
    width: 200,
    group: "Relations",
    defaultVisible: true,
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
    filter: { dataType: "enum", ops: ENUM_OPS, enumValues: TICKET_CHANNEL },
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
    cell: (t) => <SurveyStateCell ticket={t} />,
  },
  {
    id: "response",
    label: "Response",
    width: 110,
    group: "Survey",
    defaultVisible: true,
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
    sortKey: "createdAt",
    filter: { dataType: "date", ops: DATE_OPS },
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
    sortKey: "closedAt",
    filter: { dataType: "date", ops: DATE_OPS },
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
    filter: { dataType: "enum", ops: ENUM_OPS, enumValues: TICKET_HELPDESK },
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
    filter: { dataType: "date", ops: DATE_OPS },
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
    sortKey: "solvedAt",
    filter: { dataType: "date", ops: DATE_OPS },
    cell: (t) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(t.solvedAt)}
      </span>
    ),
  },
];
