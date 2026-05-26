"use server";

import {
  MULTI_ENUM_RESOLVERS,
  type DynamicValuesKey,
} from "./multi-enum-resolvers";
import type { MultiEnumValueOption } from "./multi-enum-types";

/** Fetch the distinct values currently present in a JSON-array column, with
 *  occurrence counts. Keyed by the `dynamicValuesKey` declared on the
 *  property filter spec; routed through the central resolver registry. */
export async function fetchMultiEnumValues(
  key: string,
): Promise<MultiEnumValueOption[]> {
  return MULTI_ENUM_RESOLVERS[key as DynamicValuesKey]?.() ?? [];
}
