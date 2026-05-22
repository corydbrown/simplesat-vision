"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { loadSavedViews, saveSavedViews } from "./storage";
import { SEED_VIEWS } from "./seed";
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
  /** True once localStorage has been read; before this the snapshot is the
   *  seed defaults. Sidebar uses this to suppress link flashing if needed,
   *  but mostly relies on view equality checks instead. */
  hydrated: boolean;
  getView: (entity: EntityKey, id: string) => SavedView | null;
  createView: (entity: EntityKey, name: string, state: ViewState) => SavedView;
  updateViewState: (entity: EntityKey, id: string, state: ViewState) => void;
  renameView: (entity: EntityKey, id: string, name: string) => void;
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
  // Initial state is the seed so SSR and the first client paint agree. After
  // mount we reconcile with localStorage (and write the seed if the user has
  // never customized).
  const [views, setViews] = useState<ViewsByEntity>(() => emptyByEntity());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = emptyByEntity();
    for (const entity of ENTITY_KEYS) {
      const stored = loadSavedViews(entity);
      if (stored) {
        next[entity] = stored;
      } else {
        next[entity] = SEED_VIEWS[entity];
        saveSavedViews(entity, SEED_VIEWS[entity]);
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViews(next);
    setHydrated(true);
  }, []);

  const persist = useCallback(
    (entity: EntityKey, updater: (prev: SavedView[]) => SavedView[]) => {
      setViews((prev) => {
        const nextEntity = updater(prev[entity]);
        saveSavedViews(entity, nextEntity);
        return { ...prev, [entity]: nextEntity };
      });
    },
    [],
  );

  const getView = useCallback(
    (entity: EntityKey, id: string): SavedView | null =>
      views[entity].find((v) => v.id === id) ?? null,
    [views],
  );

  const createView = useCallback(
    (entity: EntityKey, name: string, state: ViewState): SavedView => {
      const trimmed = name.trim() || "Untitled view";
      const id = nextViewId(views[entity], trimmed);
      const view: SavedView = { id, name: trimmed, state };
      persist(entity, (prev) => [...prev, view]);
      return view;
    },
    [views, persist],
  );

  const updateViewState = useCallback(
    (entity: EntityKey, id: string, state: ViewState) => {
      persist(entity, (prev) =>
        prev.map((v) => (v.id === id ? { ...v, state } : v)),
      );
    },
    [persist],
  );

  const renameView = useCallback(
    (entity: EntityKey, id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      persist(entity, (prev) =>
        prev.map((v) => (v.id === id ? { ...v, name: trimmed } : v)),
      );
    },
    [persist],
  );

  return (
    <ViewsContext.Provider
      value={{
        views,
        hydrated,
        getView,
        createView,
        updateViewState,
        renameView,
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
