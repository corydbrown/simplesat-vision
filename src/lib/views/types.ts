import type { Filter } from "@/lib/filters/types";
import type { GroupSpec } from "@/lib/group/types";
import type { SortSpec } from "@/lib/sort/url-state";

export type EntityKey = "tickets" | "customers" | "responses" | "team-members";

export const ENTITY_KEYS: readonly EntityKey[] = [
  "tickets",
  "customers",
  "responses",
  "team-members",
] as const;

/** Captures everything a saved view encapsulates: sort, group, filters, and
 *  layout. `layout === null` means "page default" (Responses uses this for
 *  feed layout; other entities have no concept of layout today). */
export type ViewState = {
  sorts: SortSpec[];
  group: GroupSpec | null;
  filters: Filter[];
  layout: string | null;
};

export type SavedView = {
  id: string;
  name: string;
  state: ViewState;
};

/** Hardcoded id reserved for the immutable "All ENTITY" view. Never appears
 *  in localStorage — it is materialized in-memory by the views provider. */
export const ALL_VIEW_ID = "all";

export function emptyViewState(): ViewState {
  return { sorts: [], group: null, filters: [], layout: null };
}
