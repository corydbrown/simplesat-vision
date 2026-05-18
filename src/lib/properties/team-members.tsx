"use client";

import { TeamMemberPill } from "@/components/shared/entity-pill";
import { AvgRating } from "@/components/shared/avg-rating";
import { TeamPill } from "@/components/shared/team-pill";
import type { TeamMemberListRow } from "@/db/queries/team-members";
import { formatNumber } from "@/lib/format";
import type { Property } from "./types";

export const TEAM_MEMBER_PROPERTIES: Property<TeamMemberListRow>[] = [
  {
    id: "name",
    label: "Name",
    width: 220,
    group: "Identity",
    alwaysVisible: true,
    cell: (m) => (
      <TeamMemberPill id={m.id} name={m.name} avatarColor={m.avatarColor} />
    ),
  },
  {
    id: "role",
    label: "Role",
    width: 170,
    group: "Identity",
    defaultVisible: true,
    cell: (m) => <span className="text-muted-foreground">{m.role}</span>,
  },
  {
    id: "team",
    label: "Team",
    width: 110,
    group: "Identity",
    defaultVisible: true,
    cell: (m) => <TeamPill team={m.team} />,
  },
  {
    id: "email",
    label: "Email",
    width: 220,
    group: "Identity",
    defaultVisible: false,
    cell: (m) => <span className="text-muted-foreground">{m.email}</span>,
  },
  {
    id: "total_tickets",
    label: "Tickets handled",
    width: 140,
    group: "Activity",
    defaultVisible: true,
    align: "right",
    cell: (m) => (
      <span className="tabular-nums">{formatNumber(m.totalTickets)}</span>
    ),
  },
  {
    id: "total_responses",
    label: "Responses",
    width: 120,
    group: "Activity",
    defaultVisible: true,
    align: "right",
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
    group: "Activity",
    defaultVisible: true,
    cell: (m) => <AvgRating value={m.avgRating} threshold="team-member" />,
  },
  {
    id: "id",
    label: "Internal ID",
    width: 156,
    group: "Identity",
    defaultVisible: false,
    cell: (m) => (
      <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
    ),
  },
];
