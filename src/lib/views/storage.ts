import { listSavedViews, replaceSavedViews } from "./actions";
import type { EntityKey, SavedView } from "./types";

const LEGACY_STORAGE_PREFIX = "simplesat:savedViews:";

function legacyKey(entity: EntityKey): string {
  return `${LEGACY_STORAGE_PREFIX}${entity}`;
}

/** Loads the entity's saved views from the server. Returns [] when the
 *  workspace has no rows yet — the provider treats that as "either seed
 *  defaults or port from localStorage". The legacy `null` sentinel is gone:
 *  with server storage, "no rows" is the only empty state we can observe. */
export async function loadSavedViews(entity: EntityKey): Promise<SavedView[]> {
  return listSavedViews(entity);
}

/** Bulk-replaces the entity's saved views on the server. Used by the seed
 *  flow (first-run write of SEED_VIEWS) and the localStorage-migration flow.
 *  Steady-state mutations go through createSavedView / updateSavedView /
 *  renameSavedView / deleteSavedView so per-row timestamps survive. */
export async function saveSavedViews(
  entity: EntityKey,
  views: SavedView[],
): Promise<void> {
  await replaceSavedViews(entity, views);
}

/** Reads any pre-migration localStorage rows for an entity and removes the
 *  key. Returns null when nothing was stored, [] when stored but empty.
 *  Called by the provider on first mount to one-shot port localStorage data
 *  into the server. SSR-safe — returns null when `window` is undefined. */
export function readLegacyLocalStorage(
  entity: EntityKey,
): SavedView[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(legacyKey(entity));
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isSavedView);
  } catch {
    return null;
  }
}

export function clearLegacyLocalStorage(entity: EntityKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(legacyKey(entity));
  } catch {
    // ignore — best-effort cleanup
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
