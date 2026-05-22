import { decodeFilters, encodeFilters } from "@/lib/filters/url-state";
import { decodeGroup, encodeGroup } from "@/lib/group/url-state";
import { encodeSortParam, parseSortParam } from "@/lib/sort/url-state";
import type { ViewState } from "./types";

/** Search-param keys that a view state owns. Any other URL param (page,
 *  drawer, etc.) is orthogonal to view identity and is preserved when
 *  applying a view. */
export const VIEW_PARAM_KEYS = ["sort", "group", "f", "layout"] as const;

/** Param key used to track the currently-active view by id. */
export const VIEW_ID_PARAM = "v";

/** Serialize a view state into the URL search params it implies. */
export function writeViewState(
  params: URLSearchParams,
  state: ViewState,
): void {
  for (const key of VIEW_PARAM_KEYS) params.delete(key);
  if (state.sorts.length > 0) params.set("sort", encodeSortParam(state.sorts));
  if (state.group) params.set("group", encodeGroup(state.group));
  if (state.filters.length > 0) params.set("f", encodeFilters(state.filters));
  if (state.layout) params.set("layout", state.layout);
}

/** Read a view state out of search params. `allowedGroupIds` is provided by
 *  the caller because group is per-entity (different entities expose
 *  different groupable property ids). */
export function readViewState(
  params: URLSearchParams,
  allowedGroupIds: readonly string[],
): ViewState {
  return {
    sorts: parseSortParam(params.get("sort") ?? undefined),
    group: decodeGroup(params.get("group"), allowedGroupIds),
    filters: decodeFilters(params.get("f")),
    layout: params.get("layout"),
  };
}

/** Build the href for a sidebar view link: base path + view state + ?v=id. */
export function viewHref(
  basePath: string,
  viewId: string | null,
  state: ViewState,
): string {
  const params = new URLSearchParams();
  writeViewState(params, state);
  if (viewId) params.set(VIEW_ID_PARAM, viewId);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
