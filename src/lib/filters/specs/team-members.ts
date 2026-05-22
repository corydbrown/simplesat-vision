import {
  ENUM_OPS,
  NUMERIC_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { PropertyFilter } from "@/lib/properties/types";

// Mirrors src/db/seed.ts TEAMS — keep in sync.
export const TEAM_MEMBER_TEAMS = ["Front line", "Senior", "Specialist"];

/** Per-property filter metadata for team members. Single source of truth —
 *  the server-only field map in `../fields/team-members.ts` adds Drizzle
 *  column refs, and the property registry in
 *  `@/lib/properties/team-members.tsx` consumes these entries as the
 *  `filter:` value. */
export const TEAM_MEMBER_FILTER_SPECS = {
  name: { dataType: "string", ops: STRING_OPS },
  email: { dataType: "string", ops: STRING_OPS },
  role: { dataType: "string", ops: STRING_OPS },
  // Enum so the Front line / Senior / Specialist seeded views can express
  // themselves as `team in [...]` instead of fragile substring matching.
  team: { dataType: "enum", ops: ENUM_OPS, enumValues: TEAM_MEMBER_TEAMS },
  region: { dataType: "string", ops: STRING_OPS },
  language: { dataType: "string", ops: STRING_OPS },
  group: { dataType: "string", ops: STRING_OPS },
  total_tickets: { dataType: "number", ops: NUMERIC_OPS },
  total_responses: { dataType: "number", ops: NUMERIC_OPS },
  avg_rating: { dataType: "number", ops: NUMERIC_OPS },
} as const satisfies Record<string, PropertyFilter>;

export type TeamMemberFilterSpecId = keyof typeof TEAM_MEMBER_FILTER_SPECS;
