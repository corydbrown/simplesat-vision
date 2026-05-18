"use client";

import {
  CustomerPill,
  ResponsePill,
  TeamMemberPill,
  TicketPill,
} from "@/components/shared/entity-pill";
import type { ResponseListRow } from "@/db/queries/responses";
import { formatDateTime } from "@/lib/format";
import type { Property } from "./types";

export const RESPONSE_PROPERTIES: Property<ResponseListRow>[] = [
  {
    id: "rating",
    label: "Rating",
    width: 110,
    group: "Answer",
    alwaysVisible: true,
    cell: (r) => <ResponsePill rating={r.rating} scale={r.scale} />,
  },
  {
    id: "comment",
    label: "Comment",
    width: 420,
    group: "Answer",
    defaultVisible: true,
    cell: (r) =>
      r.comment ? (
        <span className="text-foreground/80">{r.comment}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "ticket",
    label: "Ticket",
    width: 240,
    group: "Relations",
    defaultVisible: true,
    cell: (r) =>
      r.ticketId ? (
        <TicketPill
          id={r.ticketId}
          subject={r.ticketSubject ?? undefined}
        />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "customer",
    label: "Customer",
    width: 200,
    group: "Relations",
    defaultVisible: true,
    cell: (r) =>
      r.customerId && r.customerName ? (
        <CustomerPill id={r.customerId} name={r.customerName} />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "agent",
    label: "Agent",
    width: 200,
    group: "Relations",
    defaultVisible: true,
    cell: (r) =>
      r.teamMemberId && r.teamMemberName && r.teamMemberAvatarColor ? (
        <TeamMemberPill
          id={r.teamMemberId}
          name={r.teamMemberName}
          avatarColor={r.teamMemberAvatarColor}
        />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "responded_at",
    label: "Responded",
    width: 170,
    group: "Activity",
    defaultVisible: true,
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
    group: "Identity",
    defaultVisible: false,
    cell: (r) => (
      <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
    ),
  },
];
