"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { defaultColumnState } from "@/lib/properties/types";
import type { ColumnState, Property } from "@/lib/properties/types";
import { useViews } from "@/lib/views/provider";
import { ALL_VIEW_ID, type EntityKey } from "@/lib/views/types";
import { VIEW_ID_PARAM } from "@/lib/views/url";

const PREFIX = "simplesat:cols:";

function load(tableId: string): ColumnState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + tableId);
    return raw ? (JSON.parse(raw) as ColumnState) : null;
  } catch {
    return null;
  }
}

function save(tableId: string, state: ColumnState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + tableId, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** Merge a stored partial state with the property registry so columns added
 *  since last save show up as visible with default widths, and obsolete ids
 *  drop out of the order array. */
function reconcileWithRegistry<T>(
  stored: ColumnState,
  properties: Property<T>[],
  defaults: ColumnState,
): ColumnState {
  const knownIds = new Set(properties.map((p) => p.id));
  const orderFiltered = stored.order.filter((id) => knownIds.has(id));
  const newIds = properties
    .map((p) => p.id)
    .filter((id) => !orderFiltered.includes(id));
  return {
    visibility: { ...defaults.visibility, ...stored.visibility },
    order: [...orderFiltered, ...newIds],
    widths: { ...defaults.widths, ...stored.widths },
  };
}

type Ctx = {
  state: ColumnState;
  setVisibility: (id: string, visible: boolean) => void;
  setOrder: (order: string[]) => void;
  setWidth: (id: string, width: number) => void;
  /** Replace the entire column state in one shot — used when the user resets
   *  to a saved view's stored columns. */
  replace: (state: ColumnState) => void;
  reset: () => void;
};

const ColumnStateContext = createContext<Ctx | null>(null);

/** When `entityKey` is set and the URL has `?v=<id>` pointing at a saved
 *  view, this provider sources from and writes back to that view's record
 *  in localStorage. When `entityKey` is omitted (detail-page tables) or
 *  the active view is "All", it falls back to per-`tableId` localStorage.
 *
 *  The split matters: every saved view gets its own column layout, while
 *  "All ENTITY" and embedded tables keep the simpler per-table preference
 *  so they aren't affected by a view's columns. */
export function ColumnStateProvider<T>({
  tableId,
  properties,
  entityKey,
  children,
}: {
  tableId: string;
  properties: Property<T>[];
  /** Wire this up on list pages so the columns participate in the active
   *  saved view. Omit for detail-page tables (they have no view concept). */
  entityKey?: EntityKey;
  children: React.ReactNode;
}) {
  const initial = useMemo(() => defaultColumnState(properties), [properties]);
  const searchParams = useSearchParams();
  const viewId = entityKey
    ? (searchParams?.get(VIEW_ID_PARAM) ?? ALL_VIEW_ID)
    : ALL_VIEW_ID;
  const viewsCtx = useViews();
  const activeView =
    entityKey && viewId !== ALL_VIEW_ID
      ? viewsCtx.getView(entityKey, viewId)
      : null;
  const viewColumns = activeView?.state.columns ?? null;

  const [state, setState] = useState<ColumnState>(initial);
  // Tracks the last source we synced from, so navigating away and back to
  // the same view doesn't re-run the reconcile unless the source genuinely
  // changed (preventing spurious useEffect cascades on every render).
  const lastSourceRef = useRef<string>("");

  useEffect(() => {
    // Source 1: an active saved view that has columns stored.
    if (viewColumns) {
      const reconciled = reconcileWithRegistry(viewColumns, properties, initial);
      const signature = `view:${activeView?.id}`;
      if (lastSourceRef.current !== signature) {
        lastSourceRef.current = signature;
        setState(reconciled);
      }
      return;
    }
    // Source 2: a saved view that hasn't been customized yet — keep the
    // per-tableId fallback so the user's default layout still applies.
    // Source 3 (else): All view / no entityKey → per-tableId fallback.
    const stored = load(tableId);
    const signature = `table:${tableId}:${stored ? JSON.stringify(stored) : "default"}`;
    if (lastSourceRef.current !== signature) {
      lastSourceRef.current = signature;
      setState(stored ? reconcileWithRegistry(stored, properties, initial) : initial);
    }
  }, [tableId, properties, initial, viewColumns, activeView?.id]);

  // Persist mutations. Two destinations depending on the active source:
  //  - on a saved view → update view.state.columns
  //  - otherwise → write to per-tableId localStorage
  useEffect(() => {
    if (!lastSourceRef.current) return; // skip the very first render before sync
    if (activeView && entityKey) {
      // Only persist if the columns actually changed — avoids a write loop
      // when the source effect re-synced us to the view's existing columns.
      if (
        activeView.state.columns &&
        JSON.stringify(activeView.state.columns) === JSON.stringify(state)
      ) {
        return;
      }
      viewsCtx.updateViewState(entityKey, activeView.id, {
        ...activeView.state,
        columns: state,
      });
    } else {
      save(tableId, state);
    }
    // viewsCtx is stable across renders (memoized inside ViewsProvider via
    // useCallback) so omitting it here avoids re-running this effect on
    // every state change from elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tableId, activeView?.id, entityKey]);

  const setVisibility = useCallback(
    (id: string, visible: boolean) =>
      setState((s) => ({ ...s, visibility: { ...s.visibility, [id]: visible } })),
    [],
  );
  const setOrder = useCallback(
    (order: string[]) => setState((s) => ({ ...s, order })),
    [],
  );
  const setWidth = useCallback(
    (id: string, width: number) =>
      setState((s) => ({ ...s, widths: { ...s.widths, [id]: width } })),
    [],
  );
  const replace = useCallback(
    (next: ColumnState) => setState(reconcileWithRegistry(next, properties, initial)),
    [properties, initial],
  );
  const reset = useCallback(() => setState(initial), [initial]);

  const value: Ctx = { state, setVisibility, setOrder, setWidth, replace, reset };

  return (
    <ColumnStateContext.Provider value={value}>
      {children}
    </ColumnStateContext.Provider>
  );
}

export function useColumnState() {
  const ctx = useContext(ColumnStateContext);
  if (!ctx)
    throw new Error("useColumnState must be used inside ColumnStateProvider");
  return ctx;
}

/** Same as `useColumnState` but returns null when no provider is mounted —
 *  used by toolbar slots (ViewActions) that live alongside the table and
 *  want to peek at column state without coupling to where it's mounted. */
export function useColumnStateMaybe() {
  return useContext(ColumnStateContext);
}
