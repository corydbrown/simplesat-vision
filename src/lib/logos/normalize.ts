/** Normalize a user-typed domain to the hostname form Brandfetch (and most
 *  logo providers) accept: lowercase, no scheme, no path, no trailing slash,
 *  no `www.` prefix. Returns null when the input doesn't contain a parsable
 *  hostname so the caller can surface "invalid domain" without throwing. */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Strip scheme + path by routing through URL when it looks URL-shaped;
  // otherwise treat the input as a bare hostname.
  let host = trimmed;
  if (trimmed.includes("://")) {
    try {
      host = new URL(trimmed).hostname;
    } catch {
      return null;
    }
  } else {
    // Bare host may still have a path suffix (e.g. "simplesat.io/foo").
    host = trimmed.split("/")[0] ?? "";
  }

  if (host.startsWith("www.")) host = host.slice(4);

  // Minimum viable hostname: at least one dot, no whitespace, no invalid
  // characters. We deliberately stay loose — Brandfetch will 404 on garbage
  // and the caller surfaces that as `not_found`.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
  return host;
}
