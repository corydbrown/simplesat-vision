import "server-only";
import { schema } from "@/db/client";
import type { GroupFieldMap } from "../compile";

export const CUSTOMER_GROUP_FIELDS: GroupFieldMap = {
  tier: schema.customers.tier,
  language: schema.customers.language,
  organization: schema.customers.organization,
};

export const CUSTOMER_GROUP_IDS = Object.keys(CUSTOMER_GROUP_FIELDS);
