import "server-only";

import { normalizeDomain } from "./normalize";
import type { LogoProvider, ResolveLogoResult } from "./types";

/**
 * Brandfetch CDN logo provider.
 *
 * URL pattern: `https://cdn.brandfetch.io/{domain}?c={clientId}`. The clientId
 * is free-tier (register at developers.brandfetch.com) and required on every
 * request per Brandfetch's fair-use policy. We persist the full URL (including
 * `?c=`) verbatim so the `<img>` tag in the browser fetches from the CDN
 * directly — no server-side proxy, no re-host.
 *
 * Verification: we HEAD the constructed URL before declaring success so the
 * UI can distinguish "no logo for this domain" from "saved a broken URL."
 * Brandfetch's CDN returns 404 for unknown domains and 200 for known brands.
 */
export class BrandfetchProvider implements LogoProvider {
  readonly name = "brandfetch";

  constructor(private readonly clientId: string) {}

  async resolveLogo(input: string): Promise<ResolveLogoResult> {
    const domain = normalizeDomain(input);
    if (!domain) {
      return {
        ok: false,
        reason: "invalid_domain",
        message: `"${input}" doesn't look like a domain (e.g. simplesat.io).`,
      };
    }

    const url = `https://cdn.brandfetch.io/${encodeURIComponent(domain)}?c=${encodeURIComponent(this.clientId)}`;

    let res: Response;
    try {
      res = await fetch(url, { method: "HEAD", redirect: "follow" });
    } catch (err) {
      return {
        ok: false,
        reason: "upstream_error",
        message: `Brandfetch request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        reason: "not_found",
        message: `Brandfetch has no logo for ${domain}.`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: "upstream_error",
        message: `Brandfetch returned HTTP ${res.status} for ${domain}.`,
      };
    }

    return { ok: true, logoUrl: url };
  }
}
