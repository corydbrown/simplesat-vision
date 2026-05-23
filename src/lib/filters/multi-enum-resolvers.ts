import "server-only";
import { RESPONSE_MULTI_ENUM_RESOLVERS } from "./specs/responses";
import { TICKET_MULTI_ENUM_RESOLVERS } from "./specs/tickets";

/** Distinct value + label + occurrence count returned by every multi_enum
 *  resolver and rendered in the dynamic-values popover. */
export type MultiEnumValueOption = {
  value: string;
  /** Human-readable label. Equals `value` unless the resolver overrides it
   *  (e.g. topics resolve slugs → display labels). */
  label: string;
  count: number;
};

/** One resolver per multi_enum field. Returns the distinct values currently
 *  present in the underlying JSON-array column, with occurrence counts,
 *  sorted by count desc then value asc. */
export type MultiEnumResolver = () => Promise<MultiEnumValueOption[]>;

/** Central resolver registry. Each entity's spec file owns its resolvers
 *  alongside its specs; this file just stitches them together. The keys
 *  form `DynamicValuesKey`, which `PropertyFilter.dynamicValuesKey` is
 *  constrained to — so a spec declaring a key that isn't registered here
 *  fails at type-check rather than silently returning []. */
export const MULTI_ENUM_RESOLVERS = {
  ...TICKET_MULTI_ENUM_RESOLVERS,
  ...RESPONSE_MULTI_ENUM_RESOLVERS,
} satisfies Record<string, MultiEnumResolver>;

export type DynamicValuesKey = keyof typeof MULTI_ENUM_RESOLVERS;
