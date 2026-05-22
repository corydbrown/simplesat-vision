import {
  DATE_OPS,
  NUMERIC_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { PropertyFilter } from "@/lib/properties/types";

/** Per-property filter metadata for responses. Single source of truth — the
 *  server-only field map in `../fields/responses.ts` adds Drizzle column refs,
 *  and the property registry in `@/lib/properties/responses.tsx` consumes
 *  these entries as the `filter:` value. */
export const RESPONSE_FILTER_SPECS = {
  rating: { dataType: "number", ops: NUMERIC_OPS },
  comment: { dataType: "string", ops: STRING_OPS },
  responded_at: { dataType: "date", ops: DATE_OPS },
} as const satisfies Record<string, PropertyFilter>;

export type ResponseFilterSpecId = keyof typeof RESPONSE_FILTER_SPECS;
