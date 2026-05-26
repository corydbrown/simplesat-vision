import "server-only";
import { RESPONSE_MULTI_ENUM_RESOLVERS } from "./specs/responses";
import { TICKET_MULTI_ENUM_RESOLVERS } from "./specs/tickets";

// Types moved to `multi-enum-types.ts` (client-safe) so client components
// can import the type without dragging in this server-only module. Re-export
// here for back-compat with existing server-side imports.
export type { MultiEnumValueOption, MultiEnumResolver } from "./multi-enum-types";
import type { MultiEnumResolver } from "./multi-enum-types";

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
