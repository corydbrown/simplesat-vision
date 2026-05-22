"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  createSavedView as createSavedViewAction,
  deleteSavedView as deleteSavedViewAction,
  renameSavedView as renameSavedViewAction,
  reorderSavedViews as reorderSavedViewsAction,
  updateSavedView as updateSavedViewAction,
} from "./actions";
import { SEED_VIEWS } from "./seed";
import {
  clearLegacyLocalStorage,
  loadSavedViews,
  readLegacyLocalStorage,
  saveSavedViews,
} from "./storage";
import {
  ENTITY_KEYS,
  type EntityKey,
  type SavedView,
  type ViewState,
} from "./types";

type ViewsByEntity = Record<EntityKey, SavedView[]>;

type ViewsContextValue = {
  /** Snapshot of editable (i.e. non-"All") views per entity. */
  views: ViewsByEntity;
  /** True once server storage has been read; before this the snapshot is the
   *  seed defaults so SSR and the first client paint agree. */
  hydrated: boolean;
  getView: (entity: EntityKey, id: string) => SavedView | null;
  createView: (entity: EntityKey, name: string, state: ViewState) => SavedView;
  updateViewState: (entity: EntityKey, id: string, state: ViewState) => void;
  renameView: (entity: EntityKey, id: string, name: string) => void;
  deleteView: (entity: EntityKey, id: string) => void;
  reorderViews: (entity: EntityKey, ids: string[]) => void;
};

const ViewsContext = createContext<ViewsContextValue | null>(null);

function emptyByEntity(): ViewsByEntity {
  return {
    tickets: SEED_VIEWS.tickets,
    customers: SEED_VIEWS.customers,
    responses: SEED_VIEWS.responses,
    "team-members": SEED_VIEWS["team-members"],
  };
}

export function ViewsProvider({ children }: { children: React.ReactNode }) {
  const [views, setViews] = useState<ViewsByEntity>(() => emptyByEntity());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Per-entity try/catch keeps a failure on one entity from killing the
    // seed for the rest — and surfaces the error in dev rather than dropping
    // it as an unhandled promise rejection.
    async function hydrate(entity: EntityKey): Promise<SavedView[]> {
      const stored = await loadSavedViews(entity);
      if (stored.length > 0) return stored;

      const legacy = readLegacyLocalStorage(entity);
      if (legacy && legacy.length > 0) {
        await saveSavedViews(entity, legacy);
        clearLegacyLocalStorage(entity);
        return legacy;
      }
      if (legacy !== null) clearLegacyLocalStorage(entity);

      // Fresh prototype: seed Insider / Detractors / Unassigned / etc. so
      // a `db:reset` still leaves a populated sidebar.
      await saveSavedViews(entity, SEED_VIEWS[entity]);
      return SEED_VIEWS[entity];
    }

    (async () => {
      const results = await Promise.all(
        ENTITY_KEYS.map(async (entity) => {
          try {
            return [entity, await hydrate(entity)] as const;
          } catch (err) {
            console.error(
              `[ViewsProvider] failed to hydrate "${entity}", falling back to in-memory seed`,
              err,
            );
            return [entity, SEED_VIEWS[entity]] as const;
          }
        }),
      );
      if (cancelled) return;
      const next = emptyByEntity();
      for (const [entity, views] of results) next[entity] = views;
      setViews(next);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getView = useCallback(
    (entity: EntityKey, id: string): SavedView | null =>
      views[entity].find((v) => v.id === id) ?? null,
    [views],
  );

  const createView = useCallback(
    (entity: EntityKey, name: string, state: ViewState): SavedView => {
      const trimmed = name.trim() || "Untitled view";
      const id = nextViewId(views[entity], trimmed);
      // Append at the end of the sidebar — mirrors the server query's
      // MAX(position)+1 so the optimistic state agrees with what we'll
      // read back on next hydration.
      const maxPos = views[entity].reduce(
        (m, v) => (v.position !== undefined && v.position > m ? v.position : m),
        -1,
      );
      const view: SavedView = {
        id,
        name: trimmed,
        state,
        position: maxPos + 1,
      };
      setViews((prev) => ({ ...prev, [entity]: [...prev[entity], view] }));
      void createSavedViewAction(entity, view);
      return view;
    },
    [views],
  );

  const updateViewState = useCallback(
    (entity: EntityKey, id: string, state: ViewState) => {
      setViews((prev) => ({
        ...prev,
        [entity]: prev[entity].map((v) =>
          v.id === id ? { ...v, state } : v,
        ),
      }));
      void updateSavedViewAction(entity, id, state);
    },
    [],
  );

  const renameView = useCallback(
    (entity: EntityKey, id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setViews((prev) => ({
        ...prev,
        [entity]: prev[entity].map((v) =>
          v.id === id ? { ...v, name: trimmed } : v,
        ),
      }));
      void renameSavedViewAction(entity, id, trimmed);
    },
    [],
  );

  const deleteView = useCallback((entity: EntityKey, id: string) => {
    setViews((prev) => ({
      ...prev,
      [entity]: prev[entity].filter((v) => v.id !== id),
    }));
    void deleteSavedViewAction(entity, id);
  }, []);

  const reorderViews = useCallback((entity: EntityKey, ids: string[]) => {
    setViews((prev) => {
      const byId = new Map(prev[entity].map((v) => [v.id, v] as const));
      const next: SavedView[] = [];
      ids.forEach((id, i) => {
        const v = byId.get(id);
        if (v) {
          next.push({ ...v, position: i });
          byId.delete(id);
        }
      });
      // Append any rows not present in the supplied ids (defensive — caller
      // passes the full set today). They keep whatever position they had.
      for (const v of byId.values()) next.push(v);
      return { ...prev, [entity]: next };
    });
    void reorderSavedViewsAction(entity, ids);
  }, []);

  return (
    <ViewsContext.Provider
      value={{
        views,
        hydrated,
        getView,
        createView,
        updateViewState,
        renameView,
        deleteView,
        reorderViews,
      }}
    >
      {children}
    </ViewsContext.Provider>
  );
}

export function useViews(): ViewsContextValue {
  const ctx = useContext(ViewsContext);
  if (!ctx) {
    throw new Error("useViews must be used within <ViewsProvider>");
  }
  return ctx;
}

/** Returns the saved views for one entity. Convenience over `useViews()`
 *  when a component only cares about a single entity (sidebar section,
 *  list page toolbar). */
export function useEntityViews(entity: EntityKey): SavedView[] {
  return useViews().views[entity];
}

function nextViewId(existing: SavedView[], name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "view";
  const used = new Set(existing.map((v) => v.id));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
