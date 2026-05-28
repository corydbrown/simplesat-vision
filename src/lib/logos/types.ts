/**
 * Logo provider interface — the abstraction over "given a public-web domain,
 * give me back a logo URL." Phase 1 ships one impl (Brandfetch's free CDN);
 * a mock provider that returns a deterministic placeholder lives next to it
 * for seed/CI. Same call sites, same shapes — swap is one config knob.
 *
 * Provider returns a URL string the browser can render directly via an
 * `<img>` tag — no proxying or re-hosting. The URL may include query params
 * the provider needs (e.g. Brandfetch's `?c=<clientId>`), so callers MUST
 * persist the URL verbatim rather than reconstructing it elsewhere.
 */

export type ResolveLogoResult =
  | { ok: true; logoUrl: string }
  | { ok: false; reason: ResolveLogoErrorReason; message: string };

/** Discrete failure modes so UI can render a useful message without parsing
 *  freeform strings. `not_found` is recoverable (try a different domain);
 *  `not_configured` means the deploy is missing required env. */
export type ResolveLogoErrorReason =
  | "invalid_domain"
  | "not_found"
  | "not_configured"
  | "upstream_error";

export interface LogoProvider {
  /** Provider identity — useful for telemetry / future audit columns. */
  readonly name: string;
  /** Resolve a logo URL for a public-web domain. Domain comes in as the
   *  user typed it (e.g. "simplesat.io", "https://simplesat.io/", or
   *  "www.simplesat.io"); the provider is responsible for normalizing. */
  resolveLogo(domain: string): Promise<ResolveLogoResult>;
}
