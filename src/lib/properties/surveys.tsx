"use client";

import { SurveyPill } from "@/components/shared/entity-pill";
import type { SurveyRow } from "@/db/queries/surveys";
import { formatDate, formatNumber } from "@/lib/format";
import type { Property } from "./types";

const METRIC_LABEL: Record<SurveyRow["metric"], string> = {
  csat: "CSAT",
  nps: "NPS",
  ces: "CES",
  five_star: "5-Star",
  custom: "Custom",
};

const CHANNEL_LABEL: Record<SurveyRow["channel"], string> = {
  intercom: "Intercom",
  zendesk: "Zendesk",
  oneoff_email: "Email (one-off)",
  web_embed: "Web embed",
  generic_embed: "Generic embed",
};

const STATUS_LABEL: Record<SurveyRow["status"], string> = {
  active: "Active",
  archived: "Archived",
  draft: "Draft",
};

const STATUS_TONE: Record<SurveyRow["status"], string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  archived: "bg-muted text-muted-foreground ring-border",
  draft: "bg-amber-50 text-amber-700 ring-amber-200",
};

export const SURVEY_PROPERTIES: Property<SurveyRow>[] = [
  {
    id: "name",
    label: "Name",
    width: 260,
    group: "Identity",
    alwaysVisible: true,
    cell: (s) => <SurveyPill id={s.id} name={s.name} metric={s.metric} />,
  },
  {
    id: "metric",
    label: "Metric",
    width: 110,
    group: "Identity",
    defaultVisible: true,
    cell: (s) => (
      <span className="text-muted-foreground">{METRIC_LABEL[s.metric]}</span>
    ),
  },
  {
    id: "channel",
    label: "Channel",
    width: 150,
    group: "Identity",
    defaultVisible: true,
    cell: (s) => (
      <span className="text-muted-foreground">{CHANNEL_LABEL[s.channel]}</span>
    ),
  },
  {
    id: "status",
    label: "Status",
    width: 110,
    group: "Identity",
    defaultVisible: true,
    cell: (s) => (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${STATUS_TONE[s.status]}`}
      >
        {STATUS_LABEL[s.status]}
      </span>
    ),
  },
  {
    id: "scale",
    label: "Scale",
    width: 80,
    group: "Identity",
    defaultVisible: false,
    align: "right",
    cell: (s) => <span className="tabular-nums text-muted-foreground">{s.scale}</span>,
  },
  {
    id: "total_responses",
    label: "Responses",
    width: 120,
    group: "Activity",
    defaultVisible: true,
    align: "right",
    cell: (s) => (
      <span className="tabular-nums text-muted-foreground">
        {formatNumber(s.totalResponses)}
      </span>
    ),
  },
  {
    id: "avg_rating",
    label: "Avg rating",
    width: 110,
    group: "Activity",
    defaultVisible: true,
    align: "right",
    cell: (s) => (
      <span className="tabular-nums text-muted-foreground">
        {s.avgRating != null ? s.avgRating.toFixed(2) : "-"}
      </span>
    ),
  },
  {
    id: "created_at",
    label: "Created",
    width: 130,
    group: "Activity",
    defaultVisible: false,
    cell: (s) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(s.createdAt)}
      </span>
    ),
  },
  {
    id: "id",
    label: "Internal ID",
    width: 156,
    group: "Identity",
    defaultVisible: false,
    cell: (s) => (
      <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
    ),
    detail: (s) => <span className="text-muted-foreground">{s.id}</span>,
  },
];

export const SURVEY_METRIC_LABEL = METRIC_LABEL;
export const SURVEY_CHANNEL_LABEL = CHANNEL_LABEL;
