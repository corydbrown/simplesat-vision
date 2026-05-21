import "server-only";
import { schema } from "@/db/client";
import type { GroupFieldMap } from "../compile";

export const TEAM_MEMBER_GROUP_FIELDS: GroupFieldMap = {
  role: schema.teamMembers.role,
  team: schema.teamMembers.team,
  region: schema.teamMembers.region,
  language: schema.teamMembers.language,
  group: schema.teamMemberGroups.name,
};

export const TEAM_MEMBER_GROUP_IDS = Object.keys(TEAM_MEMBER_GROUP_FIELDS);
