"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { defaultColumnState } from "@/lib/properties/types";
import type { ColumnState, Property } from "@/lib/properties/types";

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

type Ctx = {
  state: ColumnState;
  setVisibility: (id: string, visible: boolean) => void;
  setOrder: (order: string[]) => void;
  setWidth: (id: string, width: number) => void;
  reset: () => void;
};

const ColumnStateContext = createContext<Ctx | null>(null);

export function ColumnStateProvider<T>({
  tableId,
  properties,
  children,
}: {
  tableId: string;
  properties: Property<T>[];
  children: React.ReactNode;
}) {
  const initial = useMemo(() => defaultColumnState(properties), [properties]);
  const [state, setState] = useState<ColumnState>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = load(tableId);
    if (stored) {
      const knownIds = new Set(properties.map((p) => p.id));
      const orderFiltered = stored.order.filter((id) => knownIds.has(id));
      const newIds = properties
        .map((p) => p.id)
        .filter((id) => !orderFiltered.includes(id));
      setState({
        visibility: { ...initial.visibility, ...stored.visibility },
        order: [...orderFiltered, ...newIds],
        widths: { ...initial.widths, ...stored.widths },
      });
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useEffect(() => {
    if (hydrated) save(tableId, state);
  }, [tableId, state, hydrated]);

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
  const reset = useCallback(() => setState(initial), [initial]);

  const value: Ctx = { state, setVisibility, setOrder, setWidth, reset };

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
