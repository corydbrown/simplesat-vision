import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { buildFilterFields } from "@/lib/filters/build-fields";
import { CUSTOMER_FILTER_SPECS } from "@/lib/filters/specs/customers";

// Subquery-backed expressions used for both filtering and list selection /
// sorting. Defined here so the query file can import them without circularity
// (the query imports the field map; the field map must not import back).
export const customerTotalTicketsExpr = sql<number>`(SELECT COUNT(*) FROM tickets WHERE tickets.customer_id = customers.id)`;
export const customerAvgRatingExpr = sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.customer_id = customers.id)`;
export const customerLastSeenExpr = sql<number | null>`(SELECT MAX(tickets.created_at) FROM tickets WHERE tickets.customer_id = customers.id)`;

export const CUSTOMER_FILTER_FIELDS = buildFilterFields(CUSTOMER_FILTER_SPECS, {
  name: schema.customers.name,
  email: schema.customers.email,
  tier: schema.customers.tier,
  language: schema.customers.language,
  company: schema.customers.company,
  company_external_id: schema.customers.companyExternalId,
  company_domain: schema.customers.companyDomain,
  total_tickets: customerTotalTicketsExpr,
  avg_rating: customerAvgRatingExpr,
});
