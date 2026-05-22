import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db/client";
import {
  NUMERIC_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { ListFilterFieldMap } from "../compile-list";

// Subquery-backed expressions used for both filtering and list selection /
// sorting. Defined here so the query file can import them without circularity
// (the query imports the field map; the field map must not import back).
export const teamMemberTotalTicketsExpr = sql<number>`(SELECT COUNT(*) FROM tickets WHERE tickets.assigned_team_member_id = team_members.id)`;
export const teamMemberAvgRatingExpr = sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.team_member_id = team_members.id)`;
export const teamMemberTotalResponsesExpr = sql<number>`(SELECT COUNT(*) FROM responses WHERE responses.team_member_id = team_members.id)`;

export const TEAM_MEMBER_FILTER_FIELDS: ListFilterFieldMap = {
  name: {
    id: "name",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.teamMembers.name,
  },
  email: {
    id: "email",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.teamMembers.email,
  },
  role: {
    id: "role",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.teamMembers.role,
  },
  team: {
    id: "team",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.teamMembers.team,
  },
  region: {
    id: "region",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.teamMembers.region,
  },
  language: {
    id: "language",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.teamMembers.language,
  },
  group: {
    id: "group",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.teamMemberGroups.name,
  },
  total_tickets: {
    id: "total_tickets",
    dataType: "number",
    ops: NUMERIC_OPS,
    column: teamMemberTotalTicketsExpr,
  },
  total_responses: {
    id: "total_responses",
    dataType: "number",
    ops: NUMERIC_OPS,
    column: teamMemberTotalResponsesExpr,
  },
  avg_rating: {
    id: "avg_rating",
    dataType: "number",
    ops: NUMERIC_OPS,
    column: teamMemberAvgRatingExpr,
  },
};
