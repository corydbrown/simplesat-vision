import type { EntityKey, SavedView } from "./types";

const STORAGE_PREFIX = "simplesat:savedViews:";

function storageKey(entity: EntityKey): string {
  return `${STORAGE_PREFIX}${entity}`;
}

/** Returns null when no saved set has ever been written for this entity —
 *  the provider distinguishes that from "saved an empty list" so it can
 *  re-seed defaults on first load and after a localStorage clear. */
export function loadSavedViews(entity: EntityKey): SavedView[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(entity));
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isSavedView);
  } catch {
    return null;
  }
}

export function saveSavedViews(entity: EntityKey, views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(entity), JSON.stringify(views));
  } catch {
    // ignore quota errors — view metadata is small but we never want a
    // localStorage failure to break the app
  }
}

function isSavedView(v: unknown): v is SavedView {
  if (!v || typeof v !== "object") return false;
  const x = v as Partial<SavedView>;
  return (
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    !!x.state &&
    typeof x.state === "object"
  );
}
