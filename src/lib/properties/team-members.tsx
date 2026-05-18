"use client";

import { Star } from "lucide-react";
import { TeamMemberPill } from "@/components/shared/entity-pill";
import type { TeamMemberListRow } from "@/db/queries/team-members";
import { formatNumber } from "@/lib/format";
import type { Property } from "./types";

function AvgRating({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">-</span>;
  const tone =
    value < 3.5
      ? "text-red-600"
      : value < 4
        ? "text-amber-600"
        : "text-emerald-600";
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      <Star size={11} className="fill-current" />
      <span className="tabular-nums font-medium">{value.toFixed(2)}</span>
    </span>
  );
}

function TeamPill({ team }: { team: string }) {
  const tone =
    team === "Tier 1"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : "bg-violet-50 text-violet-700 ring-violet-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {team}
    </span>
  );
}

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
    cell: (m) => <AvgRating value={m.avgRating} />,
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
