import type { ViewState } from "./types";

/** Stable serialization that ignores object-key order so two equivalent
 *  view states are guaranteed to compare equal regardless of how they
 *  were constructed. Array order IS preserved — sort priority and filter
 *  order are semantically meaningful (sort affects ORDER BY priority,
 *  filter order affects how chips render in the toolbar). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return "[" + value.map(canonical).join(",") + "]";
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + canonical(obj[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

/** Compare only the URL-encoded fields (sort, group, filters, layout).
 *  Column state is persisted per-view as the user resizes / reorders / toggles
 *  visibility, so it is always in sync by the time the toolbar evaluates
 *  dirty — including it here would leave the Reset / Save buttons visible
 *  forever after the first column tweak. */
export function viewStateEquals(a: ViewState, b: ViewState): boolean {
  return (
    canonical({
      sorts: a.sorts,
      group: a.group,
      filters: a.filters,
      layout: a.layout,
    }) ===
    canonical({
      sorts: b.sorts,
      group: b.group,
      filters: b.filters,
      layout: b.layout,
    })
  );
}
