import {
  ENUM_OPS,
  NUMERIC_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { PropertyFilter } from "@/lib/properties/types";

export const CUSTOMER_TIERS = ["insider", "gold", "elite"];

/** Per-property filter metadata for customers. Single source of truth — the
 *  server-only field map in `../fields/customers.ts` adds Drizzle column refs,
 *  and the property registry in `@/lib/properties/customers.tsx` consumes
 *  these entries as the `filter:` value. */
export const CUSTOMER_FILTER_SPECS = {
  name: { dataType: "string", ops: STRING_OPS },
  email: { dataType: "string", ops: STRING_OPS },
  tier: { dataType: "enum", ops: ENUM_OPS, enumValues: CUSTOMER_TIERS },
  language: { dataType: "string", ops: STRING_OPS },
  company: { dataType: "string", ops: STRING_OPS },
  company_external_id: { dataType: "string", ops: STRING_OPS },
  company_domain: { dataType: "string", ops: STRING_OPS },
  total_tickets: { dataType: "number", ops: NUMERIC_OPS },
  avg_rating: { dataType: "number", ops: NUMERIC_OPS },
} as const satisfies Record<string, PropertyFilter>;

export type CustomerFilterSpecId = keyof typeof CUSTOMER_FILTER_SPECS;
