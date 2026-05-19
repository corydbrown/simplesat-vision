import {
  defaultConfig,
  type BaseEntity,
  type ReportConfig,
} from "./types";

const VALID_BASES: BaseEntity[] = [
  "ticket",
  "customer",
  "team_member",
  "response",
];

function b64encode(s: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(s, "utf-8").toString("base64url");
  }
  // Browser: btoa needs ascii; encode via TextEncoder then map.
  const bytes = new TextEncoder().encode(s);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64decode(s: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(s, "base64url").toString("utf-8");
  }
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeConfig(config: ReportConfig): string {
  return b64encode(JSON.stringify(config));
}

export function decodeConfig(value: string | null): ReportConfig | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(b64decode(value)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const c = parsed as Partial<ReportConfig>;
    if (!c.base || !VALID_BASES.includes(c.base)) return null;
    return {
      base: c.base,
      rows: Array.isArray(c.rows) ? c.rows : [],
      columns: Array.isArray(c.columns) ? c.columns : [],
      values:
        Array.isArray(c.values) && c.values.length > 0
          ? c.values
          : [{ propertyId: "*", agg: "count" }],
      filters: Array.isArray(c.filters) ? c.filters : [],
    };
  } catch {
    return null;
  }
}

export function configFromSearchParam(
  raw: string | string[] | undefined,
  fallbackBase: BaseEntity = "response",
): ReportConfig {
  const value = typeof raw === "string" ? raw : null;
  return decodeConfig(value) ?? defaultConfig(fallbackBase);
}
