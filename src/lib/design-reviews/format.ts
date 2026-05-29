/** Format a date-only ISO string (YYYY-MM-DD) for display. Parsed and rendered
 *  in UTC so a date-only value never shifts a day across server/client time
 *  zones. Pure — no implicit `Date.now()`. */
export function formatReviewDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
