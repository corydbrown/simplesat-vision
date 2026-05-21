import type { RelativeValue } from "./types";

/** Convert a relative-date filter value to a millisecond timestamp window
 *  [start, end] suitable for `column BETWEEN start AND end` queries.
 *
 *  - "past" — the most recent N units ending now.
 *  - "next" — the next N units starting now.
 *  - "this" — the current calendar day/week/month (n is ignored).
 *
 *  Returns null when the relative value is malformed.
 */
export function relativeRangeMs(
  rv: RelativeValue,
): { start: number; end: number } | null {
  const now = new Date();
  const nowMs = now.getTime();

  if (rv.dir === "this") {
    if (rv.unit === "days") {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      const start = d.getTime();
      return { start, end: start + 24 * 60 * 60 * 1000 - 1 };
    }
    if (rv.unit === "weeks") {
      // Local week starting Sunday (matches react-day-picker default).
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay());
      const start = d.getTime();
      return { start, end: start + 7 * 24 * 60 * 60 * 1000 - 1 };
    }
    if (rv.unit === "months") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const end =
        new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;
      return { start, end };
    }
    return null;
  }

  const unitMs =
    rv.unit === "days"
      ? 24 * 60 * 60 * 1000
      : rv.unit === "weeks"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000; // months ~= 30 days
  const deltaMs = Math.max(1, rv.n) * unitMs;

  if (rv.dir === "past") {
    return { start: nowMs - deltaMs, end: nowMs };
  }
  // next
  return { start: nowMs, end: nowMs + deltaMs };
}
