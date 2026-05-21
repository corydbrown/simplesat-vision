import {
  defaultConfig,
  type AxisField,
  type AxisFieldSort,
  type BaseEntity,
  type ReportConfig,
} from "./types";

const VALID_BASES: BaseEntity[] = [
  "ticket",
  "customer",
  "team_member",
  "response",
];

function sanitizeSort(raw: unknown): AxisFieldSort | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Partial<AxisFieldSort> & Record<string, unknown>;
  const direction = s.direction === "desc" ? "desc" : s.direction === "asc" ? "asc" : undefined;
  if (!direction) return undefined;
  if (s.by === "field") return { by: "field", direction };
  if (s.by === "value" && typeof s.valueIndex === "number" && s.valueIndex >= 0) {
    return { by: "value", valueIndex: Math.floor(s.valueIndex), direction };
  }
  return undefined;
}

function sanitizeAxisField(raw: unknown): AxisField | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Partial<AxisField> & Record<string, unknown>;
  if (typeof a.propertyId !== "string" || !a.propertyId) return null;
  const out: AxisField = { propertyId: a.propertyId };
  if (typeof a.bucket === "string") out.bucket = a.bucket as AxisField["bucket"];
  const sort = sanitizeSort(a.sort);
  if (sort) out.sort = sort;
  return out;
}

function sanitizeAxisArray(raw: unknown): AxisField[] {
  if (!Array.isArray(raw)) return [];
  const out: AxisField[] = [];
  for (const item of raw) {
    const f = sanitizeAxisField(item);
    if (f) out.push(f);
  }
  return out;
}

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
      rows: sanitizeAxisArray(c.rows),
      columns: sanitizeAxisArray(c.columns),
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
