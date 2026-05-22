"use client";

import {
  Calendar,
  Hash,
  MessageSquare,
  Star,
  Ticket as TicketIcon,
  User,
  UserCircle2,
} from "lucide-react";
import {
  CustomerPill,
  ResponsePill,
  TeamMemberPill,
  TicketPill,
} from "@/components/shared/entity-pill";
import type { ResponseListRow } from "@/db/queries/responses";
import { RESPONSE_FILTER_SPECS } from "@/lib/filters/specs/responses";
import { formatDateTime } from "@/lib/format";
import type { Property } from "./types";

export const RESPONSE_PROPERTIES: Property<ResponseListRow>[] = [
  {
    id: "rating",
    label: "Rating",
    width: 110,
    icon: Star,
    sourceEntity: "Response",
    alwaysVisible: true,
    sortable: true,
    sortValue: (r) => r.rating,
    filter: RESPONSE_FILTER_SPECS.rating,
    groupable: true,
    groupValue: (r) => String(r.rating),
    groupLabel: (v) => (
      <span className="tabular-nums">{v} stars</span>
    ),
    cell: (r) => (
      <ResponsePill id={r.id} rating={r.rating} scale={r.scale} />
    ),
  },
  {
    id: "comment",
    label: "Comment",
    width: 420,
    icon: MessageSquare,
    sourceEntity: "Response",
    defaultVisible: true,
    sortable: true,
    sortValue: (r) => r.comment,
    filter: RESPONSE_FILTER_SPECS.comment,
    cell: (r) =>
      r.comment ? (
        <span className="text-foreground">{r.comment}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "ticket",
    label: "Ticket",
    width: 240,
    icon: TicketIcon,
    sourceEntity: "Ticket",
    defaultVisible: true,
    sortable: true,
    sortValue: (r) => r.ticketSubject ?? r.ticketExternalId,
    cell: (r) =>
      r.ticketId ? (
        <TicketPill
          id={r.ticketId}
          externalId={r.ticketExternalId}
          subject={r.ticketSubject ?? undefined}
        />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "customer",
    label: "Customer",
    width: 200,
    icon: User,
    sourceEntity: "Customer",
    defaultVisible: true,
    sortable: true,
    sortValue: (r) => r.customerName,
    groupable: true,
    groupValue: (r) => r.customerName,
    nullGroupLabel: "Anonymous",
    cell: (r) =>
      r.customerId && r.customerName ? (
        <CustomerPill id={r.customerId} name={r.customerName} />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "team_member",
    label: "Team member",
    width: 200,
    icon: UserCircle2,
    sourceEntity: "Team member",
    defaultVisible: true,
    sortable: true,
    sortValue: (r) => r.teamMemberName,
    groupable: true,
    groupValue: (r) => r.teamMemberName,
    nullGroupLabel: "Unassigned",
    cell: (r) =>
      r.teamMemberId && r.teamMemberName && r.teamMemberAvatarColor ? (
        <TeamMemberPill
          id={r.teamMemberId}
          name={r.teamMemberName}
          avatarColor={r.teamMemberAvatarColor}
        />
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "responded_at",
    label: "Responded",
    width: 170,
    icon: Calendar,
    sourceEntity: "Response",
    defaultVisible: true,
    sortable: true,
    sortValue: (r) => r.respondedAt,
    filter: RESPONSE_FILTER_SPECS.responded_at,
    cell: (r) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDateTime(r.respondedAt)}
      </span>
    ),
  },
  {
    id: "id",
    label: "Response ID",
    width: 156,
    icon: Hash,
    sourceEntity: "Response",
    defaultVisible: false,
    sortable: true,
    sortValue: (r) => r.id,
    cell: (r) => (
      <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
    ),
    detail: (r) => <span className="text-muted-foreground">{r.id}</span>,
  },
];
