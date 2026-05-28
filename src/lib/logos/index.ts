/**
 * Public entry point for logo resolution. Callers go through
 * `getLogoProvider()` rather than constructing a provider directly — keeping
 * the choice (today: Brandfetch only) in one place. Adding a fallback
 * provider (Clearbit, custom upload) is a switch statement here, not a code
 * search.
 *
 * Env:
 *   LOGO_PROVIDER         = brandfetch              (default: brandfetch)
 *   BRANDFETCH_CLIENT_ID  = required when provider = brandfetch (free at
 *                           developers.brandfetch.com)
 */

import "server-only";

import { BrandfetchProvider } from "./brandfetch-provider";
import type { LogoProvider, ResolveLogoResult } from "./types";

export type LogoProviderName = "brandfetch";

/** Sentinel returned when no provider can be constructed (e.g. missing env).
 *  Lets the server action surface the error inline without exception-throwing
 *  through the React boundary. */
class UnconfiguredLogoProvider implements LogoProvider {
  readonly name = "unconfigured";
  constructor(private readonly message: string) {}
  async resolveLogo(): Promise<ResolveLogoResult> {
    return { ok: false, reason: "not_configured", message: this.message };
  }
}

export function getLogoProvider(override?: LogoProviderName): LogoProvider {
  const name = override ?? resolveProviderName();
  switch (name) {
    case "brandfetch":
    default: {
      const clientId = process.env.BRANDFETCH_CLIENT_ID;
      if (!clientId) {
        return new UnconfiguredLogoProvider(
          "Set BRANDFETCH_CLIENT_ID to fetch logos. " +
            "Register a free clientId at developers.brandfetch.com.",
        );
      }
      return new BrandfetchProvider(clientId);
    }
  }
}

function resolveProviderName(): LogoProviderName {
  const raw = process.env.LOGO_PROVIDER;
  if (!raw) return "brandfetch";
  const normalized = raw.toLowerCase();
  if (normalized === "brandfetch") return normalized;
  console.warn(
    `[logos] Unrecognized LOGO_PROVIDER="${raw}". Falling back to "brandfetch".`,
  );
  return "brandfetch";
}

export { BrandfetchProvider } from "./brandfetch-provider";
export { normalizeDomain } from "./normalize";
export type { LogoProvider, ResolveLogoResult, ResolveLogoErrorReason } from "./types";
