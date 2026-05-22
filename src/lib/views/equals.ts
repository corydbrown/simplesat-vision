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

export function viewStateEquals(a: ViewState, b: ViewState): boolean {
  return canonical(a) === canonical(b);
}
