import type { MultiEnumResolver } from "@/lib/filters/multi-enum-resolvers";
import {
  DATE_OPS,
  MULTI_ENUM_OPS,
  NUMERIC_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { PropertyFilter } from "@/lib/properties/types";
import { resolveResponseTopics } from "./responses.resolvers";

/** Per-property filter metadata for responses. Single source of truth — the
 *  server-only field map in `../fields/responses.ts` adds Drizzle column refs,
 *  and the property registry in `@/lib/properties/responses.tsx` consumes
 *  these entries as the `filter:` value. */
export const RESPONSE_FILTER_SPECS = {
  rating: { dataType: "number", ops: NUMERIC_OPS },
  comment: { dataType: "string", ops: STRING_OPS },
  responded_at: { dataType: "date", ops: DATE_OPS },
  // Topics is a JSON array of TopicTag objects ({ topic, sentiment }). The
  // multi_enum compile uses json_extract(value, '$.topic') to filter by
  // topic slug; the popover fetches in-use topics with counts.
  topics: {
    dataType: "multi_enum",
    ops: MULTI_ENUM_OPS,
    enumValuesSource: "dynamic",
    dynamicValuesKey: "response.topics",
  },
} as const satisfies Record<string, PropertyFilter>;

export type ResponseFilterSpecId = keyof typeof RESPONSE_FILTER_SPECS;

/** Server-side resolvers for the response entity's dynamic multi_enum fields.
 *  Stitched into the central registry in `../multi-enum-resolvers.ts`; the
 *  keys feed `DynamicValuesKey`, so any spec above referencing a key that
 *  isn't registered here fails at type-check. */
export const RESPONSE_MULTI_ENUM_RESOLVERS = {
  "response.topics": resolveResponseTopics,
} satisfies Record<string, MultiEnumResolver>;
