import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { buildFilterFields } from "@/lib/filters/build-fields";
import { CUSTOMER_FILTER_SPECS } from "@/lib/filters/specs/customers";

// Customer aggregate expressions reference per-workspace aggregate subqueries
// (`t_agg`, `r_agg`) that listCustomers always joins. The previous shape used
// correlated scalar subqueries against tickets/responses — fine at small scale
// but quadratic against Bloom-scale data (3 subqueries × 1,200 customers =
// 3,600 index seeks per request, 87s wall clock — see SVP-162).
//
// These expressions are valid ONLY inside the listCustomers query, where the
// `t_agg` / `r_agg` subqueries are in scope. Any new query that wants to
// reuse the filter map must define the same aggregate joins or supply its
// own field map.
export const customerTotalTicketsExpr = sql<number>`COALESCE(t_agg.total_tickets, 0)`;
export const customerAvgRatingExpr = sql<number | null>`r_agg.avg_rating`;
export const customerLastSeenExpr = sql<number | null>`t_agg.last_seen`;

export const CUSTOMER_FILTER_FIELDS = buildFilterFields(CUSTOMER_FILTER_SPECS, {
  name: schema.customers.name,
  email: schema.customers.email,
  tier: schema.customers.tier,
  language: schema.customers.language,
  organization: schema.customers.organization,
  organization_external_id: schema.customers.organizationExternalId,
  organization_domain: schema.customers.organizationDomain,
  total_tickets: customerTotalTicketsExpr,
  avg_rating: customerAvgRatingExpr,
});
