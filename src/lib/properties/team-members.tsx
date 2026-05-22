"use client";

import {
  Briefcase,
  FolderClosed,
  Globe,
  Hash,
  Languages,
  Mail,
  MessageSquare,
  Star,
  Ticket as TicketIcon,
  User,
  Users,
} from "lucide-react";
import { TeamMemberPill } from "@/components/shared/entity-pill";
import { AvgRating } from "@/components/shared/avg-rating";
import { TeamPill } from "@/components/shared/team-pill";
import { TeamGroupPill } from "@/components/shared/team-group-pill";
import type { TeamMemberListRow } from "@/db/queries/team-members";
import { TEAM_MEMBER_FILTER_SPECS } from "@/lib/filters/specs/team-members";
import { formatNumber } from "@/lib/format";
import { TEAM_MEMBER_CUSTOM_FIELDS } from "./custom-fields";
import { customFieldProperties } from "./custom-field-properties";
import type { Property } from "./types";

const CORE_PROPERTIES: Property<TeamMemberListRow>[] = [
  {
    id: "name",
    label: "Name",
    width: 220,
    icon: User,
    sourceEntity: "Team member",
    alwaysVisible: true,
    sortable: true,
    sortValue: (m) => m.name,
    filter: TEAM_MEMBER_FILTER_SPECS.name,
    cell: (m) => (
      <TeamMemberPill id={m.id} name={m.name} avatarColor={m.avatarColor} />
    ),
  },
  {
    id: "role",
    label: "Role",
    width: 170,
    icon: Briefcase,
    sourceEntity: "Team member",
    defaultVisible: true,
    sortable: true,
    sortValue: (m) => m.role,
    filter: TEAM_MEMBER_FILTER_SPECS.role,
    groupable: true,
    groupValue: (m) => m.role,
    cell: (m) => <span className="text-muted-foreground">{m.role}</span>,
  },
  {
    id: "team",
    label: "Team",
    width: 110,
    icon: Users,
    sourceEntity: "Team member",
    defaultVisible: true,
    sortable: true,
    sortValue: (m) => m.team,
    filter: TEAM_MEMBER_FILTER_SPECS.team,
    groupable: true,
    groupValue: (m) => m.team,
    groupLabel: (v) => <TeamPill team={v} />,
    cell: (m) => <TeamPill team={m.team} />,
  },
  {
    id: "region",
    label: "Region",
    width: 140,
    icon: Globe,
    sourceEntity: "Team member",
    defaultVisible: true,
    sortable: true,
    sortValue: (m) => m.region,
    filter: TEAM_MEMBER_FILTER_SPECS.region,
    groupable: true,
    groupValue: (m) => m.region,
    nullGroupLabel: "No region",
    cell: (m) =>
      m.region ? (
        <span className="text-muted-foreground">{m.region}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "language",
    label: "Language",
    width: 110,
    icon: Languages,
    sourceEntity: "Team member",
    defaultVisible: false,
    sortable: true,
    sortValue: (m) => m.language,
    filter: TEAM_MEMBER_FILTER_SPECS.language,
    groupable: true,
    groupValue: (m) => m.language,
    nullGroupLabel: "No language",
    cell: (m) =>
      m.language ? (
        <span className="text-muted-foreground">{m.language}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "group",
    label: "Group",
    width: 180,
    icon: FolderClosed,
    sourceEntity: "Team member",
    defaultVisible: true,
    sortable: true,
    sortValue: (m) => m.groupName,
    filter: TEAM_MEMBER_FILTER_SPECS.group,
    groupable: true,
    groupValue: (m) => m.groupName,
    groupLabel: (v) => <TeamGroupPill name={v} />,
    nullGroupLabel: "No group",
    cell: (m) =>
      m.groupName ? (
        <TeamGroupPill name={m.groupName} />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "email",
    label: "Email",
    width: 220,
    icon: Mail,
    sourceEntity: "Team member",
    defaultVisible: false,
    sortable: true,
    sortValue: (m) => m.email,
    filter: TEAM_MEMBER_FILTER_SPECS.email,
    cell: (m) => <span className="text-muted-foreground">{m.email}</span>,
  },
  {
    id: "total_tickets",
    label: "Tickets handled",
    width: 140,
    icon: TicketIcon,
    sourceEntity: "Tickets",
    defaultVisible: true,
    align: "right",
    sortable: true,
    sortValue: (m) => m.totalTickets,
    filter: TEAM_MEMBER_FILTER_SPECS.total_tickets,
    cell: (m) => (
      <span className="tabular-nums">{formatNumber(m.totalTickets)}</span>
    ),
  },
  {
    id: "total_responses",
    label: "Responses",
    width: 120,
    icon: MessageSquare,
    sourceEntity: "Responses",
    defaultVisible: true,
    align: "right",
    sortable: true,
    sortValue: (m) => m.totalResponses,
    filter: TEAM_MEMBER_FILTER_SPECS.total_responses,
    cell: (m) => (
      <span className="tabular-nums text-muted-foreground">
        {formatNumber(m.totalResponses)}
      </span>
    ),
  },
  {
    id: "avg_rating",
    label: "Avg rating",
    width: 130,
    icon: Star,
    sourceEntity: "Responses",
    defaultVisible: true,
    sortable: true,
    sortValue: (m) => m.avgRating,
    filter: TEAM_MEMBER_FILTER_SPECS.avg_rating,
    cell: (m) => <AvgRating value={m.avgRating} threshold="team-member" />,
  },
  {
    id: "id",
    label: "Internal ID",
    width: 156,
    icon: Hash,
    sourceEntity: "Team member",
    defaultVisible: false,
    sortable: true,
    sortValue: (m) => m.id,
    cell: (m) => (
      <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
    ),
    detail: (m) => <span className="text-muted-foreground">{m.id}</span>,
  },
];

export const TEAM_MEMBER_PROPERTIES: Property<TeamMemberListRow>[] = [
  ...CORE_PROPERTIES,
  ...customFieldProperties<TeamMemberListRow>(
    TEAM_MEMBER_CUSTOM_FIELDS,
    "Team member",
  ),
];
