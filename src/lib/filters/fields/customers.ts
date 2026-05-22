import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db/client";
import {
  ENUM_OPS,
  NUMERIC_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { ListFilterFieldMap } from "../compile-list";

const CUSTOMER_TIERS = ["insider", "gold", "elite"];

// Subquery-backed expressions used for both filtering and list selection /
// sorting. Defined here so the query file can import them without circularity
// (the query imports the field map; the field map must not import back).
export const customerTotalTicketsExpr = sql<number>`(SELECT COUNT(*) FROM tickets WHERE tickets.customer_id = customers.id)`;
export const customerAvgRatingExpr = sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.customer_id = customers.id)`;
export const customerLastSeenExpr = sql<number | null>`(SELECT MAX(tickets.created_at) FROM tickets WHERE tickets.customer_id = customers.id)`;

export const CUSTOMER_FILTER_FIELDS: ListFilterFieldMap = {
  name: {
    id: "name",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.customers.name,
  },
  email: {
    id: "email",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.customers.email,
  },
  tier: {
    id: "tier",
    dataType: "enum",
    ops: ENUM_OPS,
    enumValues: CUSTOMER_TIERS,
    column: schema.customers.tier,
  },
  language: {
    id: "language",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.customers.language,
  },
  company: {
    id: "company",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.customers.company,
  },
  company_external_id: {
    id: "company_external_id",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.customers.companyExternalId,
  },
  company_domain: {
    id: "company_domain",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.customers.companyDomain,
  },
  total_tickets: {
    id: "total_tickets",
    dataType: "number",
    ops: NUMERIC_OPS,
    column: customerTotalTicketsExpr,
  },
  avg_rating: {
    id: "avg_rating",
    dataType: "number",
    ops: NUMERIC_OPS,
    column: customerAvgRatingExpr,
  },
};
