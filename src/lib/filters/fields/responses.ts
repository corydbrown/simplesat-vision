import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { buildFilterFields, multiEnumColumn } from "@/lib/filters/build-fields";
import { RESPONSE_FILTER_SPECS } from "@/lib/filters/specs/responses";

// Topics is TopicTag[] (json objects, not bare strings) — extract the
// `.topic` slug from each json_each() row to filter against. Literal SQL
// reference for the column ref, per CLAUDE.md → Conventions.
const responseTopicsExpr = sql`responses.topics`;

export const RESPONSE_FILTER_FIELDS = buildFilterFields(RESPONSE_FILTER_SPECS, {
  rating: schema.responses.rating,
  comment: schema.responses.comment,
  responded_at: schema.responses.respondedAt,
  topics: multiEnumColumn(
    responseTopicsExpr,
    sql`json_extract(value, '$.topic')`,
  ),
});
