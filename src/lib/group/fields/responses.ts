import "server-only";
import { schema } from "@/db/client";
import type { GroupFieldMap } from "../compile";

export const RESPONSE_GROUP_FIELDS: GroupFieldMap = {
  rating: schema.responses.rating,
  team_member: schema.teamMembers.name,
  customer: schema.customers.name,
};

export const RESPONSE_GROUP_IDS = Object.keys(RESPONSE_GROUP_FIELDS);
