import {
  ALL_FILTER_OPS,
  isRelativeValue,
  type Filter,
  type FilterOp,
  type FilterValue,
} from "./types";

function b64encode(s: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(s, "utf-8").toString("base64url");
  }
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

function sanitizeValue(op: FilterOp, raw: unknown): FilterValue {
  if (op === "isnull" || op === "notnull") return undefined;
  if (op === "between") {
    if (!Array.isArray(raw) || raw.length !== 2) return undefined;
    const [a, b] = raw;
    if (typeof a === "number" && typeof b === "number") return [a, b];
    if (typeof a === "string" && typeof b === "string") return [a, b];
    return undefined;
  }
  if (
    op === "in" ||
    op === "not-in" ||
    op === "contains-any" ||
    op === "contains-all" ||
    op === "excludes-any" ||
    op === "excludes-all"
  ) {
    if (!Array.isArray(raw)) return undefined;
    const strs = raw.filter((x): x is string => typeof x === "string");
    if (strs.length === raw.length) return strs;
    const nums = raw.filter((x): x is number => typeof x === "number");
    if (nums.length === raw.length) return nums;
    return undefined;
  }
  if (op === "relative") {
    return isRelativeValue(raw) ? raw : undefined;
  }
  if (
    typeof raw === "string" ||
    typeof raw === "number" ||
    typeof raw === "boolean"
  ) {
    return raw;
  }
  return undefined;
}

function sanitizeFilter(raw: unknown): Filter | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Partial<Filter> & Record<string, unknown>;
  if (typeof f.propertyId !== "string" || !f.propertyId) return null;
  if (typeof f.op !== "string") return null;
  if (!(ALL_FILTER_OPS as readonly string[]).includes(f.op)) return null;
  const op = f.op as FilterOp;
  const out: Filter = { propertyId: f.propertyId, op };
  if (op === "isnull" || op === "notnull") return out;
  // Keep the chip even when no value is set yet — the UI renders an incomplete
  // chip and the compiler skips it until the user fills the value. Drop only
  // values that were provided but malformed.
  if (f.value !== undefined) {
    const sanitized = sanitizeValue(op, f.value);
    if (sanitized !== undefined) out.value = sanitized;
  }
  return out;
}

export function encodeFilters(filters: Filter[]): string {
  return b64encode(JSON.stringify(filters));
}

export function decodeFilters(value: string | null | undefined): Filter[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(b64decode(value)) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: Filter[] = [];
    for (const raw of parsed) {
      const f = sanitizeFilter(raw);
      if (f) out.push(f);
    }
    return out;
  } catch {
    return [];
  }
}

export function filtersFromSearchParam(
  raw: string | string[] | undefined,
): Filter[] {
  const value = typeof raw === "string" ? raw : null;
  return decodeFilters(value);
}
