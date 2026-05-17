"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ChannelPill } from "./channel-pill";
import { StatusPill } from "./status-pill";
import { SurveyStateCell } from "./survey-state-cell";
import {
  CompanyPill,
  CustomerPill,
  ResponsePill,
  TeamMemberPill,
} from "@/components/shared/entity-pill";
import type { TicketsRow } from "@/db/queries/tickets";
import { formatDate, formatDuration } from "@/lib/format";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    label?: string;
    width?: number;
  }
}

export const ticketColumns: ColumnDef<TicketsRow>[] = [
  {
    id: "id",
    header: "ID",
    accessorKey: "id",
    meta: { label: "ID", width: 156 },
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
    meta: { label: "Subject", width: 280 },
    cell: ({ getValue }) => (
      <span className="text-foreground">{String(getValue())}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    meta: { label: "Status", width: 120 },
    cell: ({ row }) => <StatusPill status={row.original.status} />,
  },
  {
    id: "customer",
    header: "Customer",
    meta: { label: "Customer", width: 200 },
    cell: ({ row }) => {
      const c = row.original.customer;
      if (!c) return <span className="text-muted-foreground">-</span>;
      return <CustomerPill id={c.id} name={c.name} />;
    },
  },
  {
    id: "company",
    header: "Company",
    meta: { label: "Company", width: 180 },
    cell: ({ row }) => {
      const c = row.original.customer;
      if (!c?.company)
        return <span className="text-muted-foreground">-</span>;
      return <CompanyPill name={c.company} />;
    },
  },
  {
    id: "assignee",
    header: "Assigned to",
    meta: { label: "Assigned to", width: 180 },
    cell: ({ row }) => {
      const a = row.original.assignee;
      if (!a) return <span className="text-muted-foreground">Unassigned</span>;
      return (
        <TeamMemberPill id={a.id} name={a.name} avatarColor={a.avatarColor} />
      );
    },
  },
  {
    id: "channel",
    header: "Channel",
    accessorKey: "channel",
    meta: { label: "Channel", width: 110 },
    cell: ({ row }) => <ChannelPill channel={row.original.channel} />,
  },
  {
    id: "tags",
    header: "Tags",
    meta: { label: "Tags", width: 180 },
    cell: ({ row }) => {
      const tags = row.original.tags;
      if (!tags?.length) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    id: "resolutionTime",
    header: "Resolution time",
    meta: { label: "Resolution time", width: 140 },
    cell: ({ row }) => {
      const t = row.original;
      return (
        <span className="tabular-nums text-muted-foreground">
          {formatDuration(t.createdAt, t.solvedAt)}
        </span>
      );
    },
  },
  {
    id: "surveyState",
    header: "Survey state",
    meta: { label: "Survey state", width: 160 },
    cell: ({ row }) => <SurveyStateCell ticket={row.original} />,
  },
  {
    id: "response",
    header: "Response",
    meta: { label: "Response", width: 110 },
    cell: ({ row }) => {
      const r = row.original.response;
      if (!r) return <span className="text-muted-foreground">-</span>;
      return <ResponsePill rating={r.rating} scale={r.scale} />;
    },
  },
  {
    id: "createdAt",
    header: "Created",
    accessorKey: "createdAt",
    meta: { label: "Created", width: 120 },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "closedAt",
    header: "Closed",
    accessorKey: "closedAt",
    meta: { label: "Closed", width: 120 },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(row.original.closedAt)}
      </span>
    ),
  },
];
