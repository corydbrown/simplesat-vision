"use client";

import {
  Award,
  Building2,
  Clock,
  Hash,
  Languages,
  Link as LinkIcon,
  Mail,
  Star,
  Ticket,
  User,
} from "lucide-react";
import {
  CompanyPill,
  CustomerPill,
} from "@/components/shared/entity-pill";
import { AvgRating } from "@/components/shared/avg-rating";
import { TierPill } from "@/components/shared/tier-pill";
import type { CustomerListRow } from "@/db/queries/customers";
import { CUSTOMER_FILTER_SPECS } from "@/lib/filters/specs/customers";
import { formatDate, formatNumber } from "@/lib/format";
import { TimestampTooltip } from "@/components/shared/timestamp-tooltip";
import { CUSTOMER_CUSTOM_FIELDS } from "./custom-fields";
import { customFieldProperties } from "./custom-field-properties";
import type { Property } from "./types";

const CORE_PROPERTIES: Property<CustomerListRow>[] = [
  {
    id: "name",
    label: "Name",
    width: 220,
    icon: User,
    sourceEntity: "Customer",
    alwaysVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (c) => c.name,
    filter: CUSTOMER_FILTER_SPECS.name,
    cell: (c) => <CustomerPill id={c.id} name={c.name} />,
  },
  {
    id: "email",
    label: "Email",
    width: 220,
    icon: Mail,
    sourceEntity: "Customer",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (c) => c.email,
    filter: CUSTOMER_FILTER_SPECS.email,
    cell: (c) => <span className="text-muted-foreground">{c.email}</span>,
  },
  {
    id: "tier",
    label: "Loyalty tier",
    width: 130,
    icon: Award,
    sourceEntity: "Customer",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (c) => c.tier,
    filter: CUSTOMER_FILTER_SPECS.tier,
    groupable: true,
    groupValue: (c) => c.tier,
    groupLabel: (v) => <TierPill tier={v as CustomerListRow["tier"]} />,
    cell: (c) => <TierPill tier={c.tier} />,
  },
  {
    id: "language",
    label: "Language",
    width: 110,
    icon: Languages,
    sourceEntity: "Customer",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (c) => c.language,
    filter: CUSTOMER_FILTER_SPECS.language,
    groupable: true,
    groupValue: (c) => c.language,
    nullGroupLabel: "No language",
    cell: (c) =>
      c.language ? (
        <span className="text-muted-foreground">{c.language}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "organization",
    label: "Organization",
    width: 200,
    icon: Building2,
    sourceEntity: "Customer",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (c) => c.organization,
    filter: CUSTOMER_FILTER_SPECS.organization,
    groupable: true,
    groupValue: (c) => c.organization,
    nullGroupLabel: "No organization",
    cell: (c) => <CompanyPill name={c.organization} />,
  },
  {
    id: "organization_external_id",
    label: "Organization external ID",
    width: 170,
    icon: Hash,
    sourceEntity: "Customer",
    defaultVisible: false,
    sortable: true,
    kind: "text",
    sortValue: (c) => c.organizationExternalId,
    filter: CUSTOMER_FILTER_SPECS.organization_external_id,
    cell: (c) =>
      c.organizationExternalId ? (
        <span className="font-mono text-xs text-muted-foreground">
          {c.organizationExternalId}
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
    detail: (c) =>
      c.organizationExternalId ? (
        <span className="text-muted-foreground">{c.organizationExternalId}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "organization_domain",
    label: "Organization domain",
    width: 200,
    icon: LinkIcon,
    sourceEntity: "Customer",
    defaultVisible: false,
    sortable: true,
    kind: "text",
    sortValue: (c) => c.organizationDomain,
    filter: CUSTOMER_FILTER_SPECS.organization_domain,
    cell: (c) =>
      c.organizationDomain ? (
        <span className="text-muted-foreground">{c.organizationDomain}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    id: "total_tickets",
    label: "Tickets",
    width: 110,
    icon: Ticket,
    sourceEntity: "Tickets",
    defaultVisible: true,
    align: "right",
    sortable: true,
    kind: "text",
    sortValue: (c) => c.totalTickets,
    filter: CUSTOMER_FILTER_SPECS.total_tickets,
    cell: (c) => (
      <span className="tabular-nums text-muted-foreground">
        {formatNumber(c.totalTickets)}
      </span>
    ),
  },
  {
    id: "last_seen",
    label: "Last seen",
    width: 130,
    icon: Clock,
    sourceEntity: "Tickets",
    defaultVisible: true,
    kind: "text",
    sortable: true,
    sortValue: (c) => c.lastSeen,
    cell: (c) => (
      <TimestampTooltip date={c.lastSeen}>
        <span className="tabular-nums text-muted-foreground">
          {formatDate(c.lastSeen)}
        </span>
      </TimestampTooltip>
    ),
  },
  {
    id: "avg_rating",
    label: "Avg rating",
    width: 130,
    icon: Star,
    sourceEntity: "Responses",
    defaultVisible: true,
    kind: "component",
    sortable: true,
    sortValue: (c) => c.avgRating,
    filter: CUSTOMER_FILTER_SPECS.avg_rating,
    cell: (c) => <AvgRating value={c.avgRating} threshold="customer" />,
  },
  {
    id: "id",
    label: "Internal ID",
    width: 156,
    icon: Hash,
    sourceEntity: "Customer",
    defaultVisible: false,
    kind: "text",
    sortable: true,
    sortValue: (c) => c.id,
    cell: (c) => (
      <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
    ),
    detail: (c) => <span className="text-muted-foreground">{c.id}</span>,
  },
];

export const CUSTOMER_PROPERTIES: Property<CustomerListRow>[] = [
  ...CORE_PROPERTIES,
  ...customFieldProperties<CustomerListRow>(CUSTOMER_CUSTOM_FIELDS, "Customer"),
];
