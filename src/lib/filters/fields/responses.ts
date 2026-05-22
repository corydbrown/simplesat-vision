import "server-only";
import { schema } from "@/db/client";
import { buildFilterFields } from "@/lib/filters/build-fields";
import { RESPONSE_FILTER_SPECS } from "@/lib/filters/specs/responses";

export const RESPONSE_FILTER_FIELDS = buildFilterFields(RESPONSE_FILTER_SPECS, {
  rating: schema.responses.rating,
  comment: schema.responses.comment,
  responded_at: schema.responses.respondedAt,
});
