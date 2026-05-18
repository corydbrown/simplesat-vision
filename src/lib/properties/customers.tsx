"use client";

import { Star } from "lucide-react";
import {
  CompanyPill,
  CustomerPill,
} from "@/components/shared/entity-pill";
import type { CustomerListRow } from "@/db/queries/customers";
import { formatDate, formatNumber } from "@/lib/format";
import type { Property } from "./types";

const TIER_TONE: Record<string, string> = {
  starter: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  pro: "bg-blue-50 text-blue-700 ring-blue-200",
  enterprise: "bg-purple-50 text-purple-700 ring-purple-200",
};

const TIER_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

function TierPill({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TIER_TONE[tier] ?? ""}`}
    >
      {TIER_LABEL[tier] ?? tier}
    </span>
  );
}

function AvgRating({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">-</span>;
  const tone =
    value < 3
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

export const CUSTOMER_PROPERTIES: Property<CustomerListRow>[] = [
  {
    id: "name",
    label: "Name",
    width: 220,
    group: "Identity",
    alwaysVisible: true,
    cell: (c) => <CustomerPill id={c.id} name={c.name} />,
  },
  {
    id: "company",
    label: "Company",
    width: 200,
    group: "Identity",
    defaultVisible: true,
    cell: (c) => <CompanyPill name={c.company} />,
  },
  {
    id: "email",
    label: "Email",
    width: 220,
    group: "Identity",
    defaultVisible: true,
    cell: (c) => <span className="text-muted-foreground">{c.email}</span>,
  },
  {
    id: "tier",
    label: "Tier",
    width: 120,
    group: "Account",
    defaultVisible: true,
    cell: (c) => <TierPill tier={c.tier} />,
  },
  {
    id: "total_tickets",
    label: "Tickets",
    width: 110,
    group: "Activity",
    defaultVisible: true,
    align: "right",
    cell: (c) => (
      <span className="tabular-nums">{formatNumber(c.totalTickets)}</span>
    ),
  },
  {
    id: "avg_rating",
    label: "Avg rating",
    width: 130,
    group: "Activity",
    defaultVisible: true,
    cell: (c) => <AvgRating value={c.avgRating} />,
  },
  {
    id: "last_seen",
    label: "Last seen",
    width: 130,
    group: "Activity",
    defaultVisible: true,
    cell: (c) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(c.lastSeen)}
      </span>
    ),
  },
  {
    id: "id",
    label: "Internal ID",
    width: 156,
    group: "Identity",
    defaultVisible: false,
    cell: (c) => (
      <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
    ),
  },
];
