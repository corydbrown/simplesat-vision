import type { z } from "zod";
import { SortDirSchema, SortSpecSchema } from "./schemas";

export type SortDir = z.infer<typeof SortDirSchema>;
export type SortSpec = z.infer<typeof SortSpecSchema>;

const KEY_RE = /^[a-zA-Z0-9_]+$/;

export function parseSortParam(
  raw: string | string[] | undefined,
): SortSpec[] {
  const value = typeof raw === "string" ? raw : null;
  if (!value) return [];

  const seen = new Set<string>();
  const out: SortSpec[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx);
    const dirRaw = trimmed.slice(idx + 1);
    if (!KEY_RE.test(key)) continue;
    const dir: SortDir = dirRaw === "asc" ? "asc" : "desc";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, dir });
  }
  return out;
}

export function encodeSortParam(sorts: SortSpec[]): string {
  return sorts.map((s) => `${s.key}:${s.dir}`).join(",");
}
