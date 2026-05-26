import "server-only";
import { RESPONSE_MULTI_ENUM_RESOLVERS } from "./specs/responses";
import { TICKET_MULTI_ENUM_RESOLVERS } from "./specs/tickets";

// Types moved to `multi-enum-types.ts` (client-safe) so client components
// can import the type without dragging in this server-only module. Re-export
// here for back-compat with existing server-side imports.
export type {
  MultiEnumValueOption,
  MultiEnumResolver,
  DynamicValuesKey,
} from "./multi-enum-types";
import type {
  MultiEnumResolver,
  DynamicValuesKey,
} from "./multi-enum-types";

/** Central resolver registry. Each entity's spec file owns its resolvers
 *  alongside its specs; this file just stitches them together. `satisfies
 *  Record<DynamicValuesKey, MultiEnumResolver>` enforces that every key
 *  declared in `DynamicValuesKey` has a registered resolver — so adding a
 *  key without wiring the resolver fails at type-check rather than silently
 *  returning []. */
export const MULTI_ENUM_RESOLVERS = {
  ...TICKET_MULTI_ENUM_RESOLVERS,
  ...RESPONSE_MULTI_ENUM_RESOLVERS,
} satisfies Record<DynamicValuesKey, MultiEnumResolver>;
