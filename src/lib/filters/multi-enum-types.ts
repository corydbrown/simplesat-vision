/** Distinct value + label + occurrence count returned by every multi_enum
 *  resolver and rendered in the dynamic-values popover. Lives in its own
 *  client-safe file so client components (e.g. `multi-enum-cache.tsx`) can
 *  import the type without dragging in `multi-enum-resolvers.ts`, which is
 *  marked `server-only`. Without this split, Turbopack can emit a runtime
 *  import of the server-only module into the client bundle and fail with a
 *  ReferenceError at chunk init. */
export type MultiEnumValueOption = {
  value: string;
  /** Human-readable label. Equals `value` unless the resolver overrides it
   *  (e.g. topics resolve slugs → display labels). */
  label: string;
  count: number;
};

/** One resolver per multi_enum field. Returns the distinct values currently
 *  present in the underlying JSON-array column, with occurrence counts. */
export type MultiEnumResolver = () => Promise<MultiEnumValueOption[]>;
