import type { z } from "zod";
import type { SavedViewSchema, ViewStateSchema } from "./schemas";

export { ENTITY_KEYS, type EntityKey } from "./schemas";

/** Captures everything a saved view encapsulates. Sort/group/filter/layout
 *  are URL-encoded; column state (visibility, order, widths) is too large
 *  for the URL so it lives only inside the view's localStorage record. A
 *  view without `columns` falls back to the entity's per-tableId default. */
export type ViewState = z.infer<typeof ViewStateSchema>;

export type SavedView = z.infer<typeof SavedViewSchema>;

/** Hardcoded id reserved for the immutable "All ENTITY" view. Never appears
 *  in localStorage — it is materialized in-memory by the views provider. */
export const ALL_VIEW_ID = "all";

export function emptyViewState(): ViewState {
  return { sorts: [], group: null, filters: [], layout: null };
}
