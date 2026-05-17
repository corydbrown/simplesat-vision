"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Star } from "lucide-react";
import { ChannelPill } from "./channel-pill";
import { RelationPill } from "./relation-pill";
import { StatusPill } from "./status-pill";
import { SurveyStateCell } from "./survey-state-cell";
import type { TicketsRow } from "@/db/queries/tickets";
import { formatDate, formatDuration } from "@/lib/format";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    label?: string;
  }
}

export const ticketColumns: ColumnDef<TicketsRow>[] = [
  {
    id: "id",
    header: "ID",
    accessorKey: "id",
    meta: { label: "ID" },
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {String(getValue())}
      </span>
    ),
  },
  {
    id: "subject",
    header: "Subject",
    accessorKey: "subject",
    meta: { label: "Subject" },
    cell: ({ getValue }) => (
      <span className="text-foreground">{String(getValue())}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    meta: { label: "Status" },
    cell: ({ row }) => <StatusPill status={row.original.status} />,
  },
  {
    id: "customer",
    header: "Customer",
    meta: { label: "Customer" },
    cell: ({ row }) => {
      const c = row.original.customer;
      if (!c) return <span className="text-muted-foreground">-</span>;
      return <RelationPill label={c.name} sublabel={c.company} />;
    },
  },
  {
    id: "assignee",
    header: "Assigned to",
    meta: { label: "Assigned to" },
    cell: ({ row }) => {
      const a = row.original.assignee;
      if (!a) return <span className="text-muted-foreground">Unassigned</span>;
      return <RelationPill label={a.name} color={a.avatarColor} />;
    },
  },
  {
    id: "channel",
    header: "Channel",
    accessorKey: "channel",
    meta: { label: "Channel" },
    cell: ({ row }) => <ChannelPill channel={row.original.channel} />,
  },
  {
    id: "resolutionTime",
    header: "Resolution time",
    meta: { label: "Resolution time" },
    cell: ({ row }) => {
      const t = row.original;
      return (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDuration(t.createdAt, t.solvedAt)}
        </span>
      );
    },
  },
  {
    id: "surveyState",
    header: "Survey state",
    meta: { label: "Survey state" },
    cell: ({ row }) => <SurveyStateCell ticket={row.original} />,
  },
  {
    id: "response",
    header: "Response",
    meta: { label: "Response" },
    cell: ({ row }) => {
      const r = row.original.response;
      if (!r) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="inline-flex items-center gap-1 text-xs">
          <Star size={11} className="fill-amber-400 text-amber-400" />
          <span className="tabular-nums">
            {r.rating}/{r.scale}
          </span>
        </span>
      );
    },
  },
  {
    id: "closedAt",
    header: "Closed",
    accessorKey: "closedAt",
    meta: { label: "Closed" },
    cell: ({ row }) => (
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatDate(row.original.closedAt)}
      </span>
    ),
  },
];
