import type { GroupDir, GroupSpec } from "./types";

/**
 * URL shape: `?group=<propertyId>[:<dir>]`.
 * Missing dir → "asc". Unknown propertyId or invalid dir → null.
 */
export function decodeGroup(
  raw: string | null | undefined,
  allowedIds: readonly string[],
): GroupSpec | null {
  if (!raw) return null;
  const [id, rawDir] = raw.split(":");
  if (!id || !allowedIds.includes(id)) return null;
  const dir: GroupDir =
    rawDir === "desc" ? "desc" : rawDir === "asc" || !rawDir ? "asc" : "asc";
  return { propertyId: id, dir };
}

export function encodeGroup(spec: GroupSpec): string {
  return `${spec.propertyId}:${spec.dir}`;
}

export function groupFromSearchParam(
  raw: string | string[] | undefined,
  allowedIds: readonly string[],
): GroupSpec | null {
  const value = typeof raw === "string" ? raw : null;
  return decodeGroup(value, allowedIds);
}
