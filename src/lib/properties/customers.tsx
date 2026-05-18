"use client";

import {
  CompanyPill,
  CustomerPill,
} from "@/components/shared/entity-pill";
import { AvgRating } from "@/components/shared/avg-rating";
import { TierPill } from "@/components/shared/tier-pill";
import type { CustomerListRow } from "@/db/queries/customers";
import { formatDate, formatNumber } from "@/lib/format";
import type { Property } from "./types";

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
    cell: (c) => <AvgRating value={c.avgRating} threshold="customer" />,
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
