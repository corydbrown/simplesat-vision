import type { Filter } from "@/lib/filters/types";
import type { GroupSpec } from "@/lib/group/types";
import type { ColumnState } from "@/lib/properties/types";
import type { SortSpec } from "@/lib/sort/url-state";

export { ENTITY_KEYS, type EntityKey } from "./schemas";

/** Captures everything a saved view encapsulates. Sort/group/filter/layout
 *  are URL-encoded; column state (visibility, order, widths) is too large
 *  for the URL so it lives only inside the view's localStorage record. A
 *  view without `columns` falls back to the entity's per-tableId default. */
export type ViewState = {
  sorts: SortSpec[];
  group: GroupSpec | null;
  filters: Filter[];
  layout: string | null;
  columns?: ColumnState;
};

export type SavedView = {
  id: string;
  name: string;
  state: ViewState;
  /** Manual sort order in the sidebar. Lower comes first; undefined falls
   *  to the bottom in alphabetical order. Assigned by the server on insert
   *  and reorder; absent on freshly-constructed views before they hit the
   *  optimistic-state path. */
  position?: number;
};

/** Hardcoded id reserved for the immutable "All ENTITY" view. Never appears
 *  in localStorage — it is materialized in-memory by the views provider. */
export const ALL_VIEW_ID = "all";

export function emptyViewState(): ViewState {
  return { sorts: [], group: null, filters: [], layout: null };
}
