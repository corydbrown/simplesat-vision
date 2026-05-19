"use client";

import {
  CompanyPill,
  CustomerPill,
} from "@/components/shared/entity-pill";
import { AvgRating } from "@/components/shared/avg-rating";
import { TierPill } from "@/components/shared/tier-pill";
import type { CustomerListRow } from "@/db/queries/customers";
import { formatDate, formatNumber } from "@/lib/format";
import { CUSTOMER_CUSTOM_FIELDS } from "./custom-fields";
import { customFieldProperties } from "./custom-field-properties";
import type { Property } from "./types";

const CORE_PROPERTIES: Property<CustomerListRow>[] = [
  {
    id: "name",
    label: "Name",
    width: 220,
    group: "Identity",
    alwaysVisible: true,
    cell: (c) => <CustomerPill id={c.id} name={c.name} />,
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
    label: "Loyalty tier",
    width: 130,
    group: "Account",
    defaultVisible: true,
    cell: (c) => <TierPill tier={c.tier} />,
  },
  {
    id: "language",
    label: "Language",
    width: 110,
    group: "Identity",
    defaultVisible: false,
    cell: (c) =>
      c.language ? (
        <span className="text-muted-foreground">{c.language}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "company",
    label: "Company",
    width: 200,
    group: "Account",
    defaultVisible: true,
    cell: (c) => <CompanyPill name={c.company} />,
  },
  {
    id: "company_external_id",
    label: "Company external ID",
    width: 170,
    group: "Account",
    defaultVisible: false,
    cell: (c) =>
      c.companyExternalId ? (
        <span className="font-mono text-xs text-muted-foreground">
          {c.companyExternalId}
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    detail: (c) =>
      c.companyExternalId ? (
        <span className="text-muted-foreground">{c.companyExternalId}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "company_domain",
    label: "Company domain",
    width: 200,
    group: "Account",
    defaultVisible: false,
    cell: (c) =>
      c.companyDomain ? (
        <span className="text-muted-foreground">{c.companyDomain}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "total_tickets",
    label: "Tickets",
    width: 110,
    group: "Activity",
    defaultVisible: true,
    align: "right",
    cell: (c) => (
      <span className="tabular-nums text-muted-foreground">
        {formatNumber(c.totalTickets)}
      </span>
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
    detail: (c) => <span className="text-muted-foreground">{c.id}</span>,
  },
];

export const CUSTOMER_PROPERTIES: Property<CustomerListRow>[] = [
  ...CORE_PROPERTIES,
  ...customFieldProperties<CustomerListRow>(CUSTOMER_CUSTOM_FIELDS),
];
