import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { buildFilterFields } from "@/lib/filters/build-fields";
import { TEAM_MEMBER_FILTER_SPECS } from "@/lib/filters/specs/team-members";

// Subquery-backed expressions used for both filtering and list selection /
// sorting. Defined here so the query file can import them without circularity
// (the query imports the field map; the field map must not import back).
export const teamMemberTotalTicketsExpr = sql<number>`(SELECT COUNT(*) FROM tickets WHERE tickets.team_member_id = team_members.id)`;
export const teamMemberAvgRatingExpr = sql<number | null>`(SELECT AVG(CAST(rating as REAL)) FROM responses WHERE responses.team_member_id = team_members.id)`;
export const teamMemberTotalResponsesExpr = sql<number>`(SELECT COUNT(*) FROM responses WHERE responses.team_member_id = team_members.id)`;

export const TEAM_MEMBER_FILTER_FIELDS = buildFilterFields(
  TEAM_MEMBER_FILTER_SPECS,
  {
    name: schema.teamMembers.name,
    email: schema.teamMembers.email,
    role: schema.teamMembers.role,
    team: schema.teamMembers.team,
    region: schema.teamMembers.region,
    language: schema.teamMembers.language,
    group: schema.teamMemberGroups.name,
    total_tickets: teamMemberTotalTicketsExpr,
    total_responses: teamMemberTotalResponsesExpr,
    avg_rating: teamMemberAvgRatingExpr,
  },
);
