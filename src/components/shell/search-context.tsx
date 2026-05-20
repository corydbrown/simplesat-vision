"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { SearchPalette } from "./search-palette";

type SearchValue = {
  open: () => void;
};

const SearchContext = createContext<SearchValue | null>(null);

export function useSearch(): SearchValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearch must be used inside <SearchProvider>");
  }
  return ctx;
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);

  // Cmd+K / Ctrl+K opens the palette from anywhere. The cmdk Command inside
  // handles its own keyboard navigation once open, and Esc is wired up by
  // the Radix Dialog.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SearchContext.Provider value={{ open }}>
      {children}
      <SearchPalette open={isOpen} onOpenChange={setIsOpen} />
    </SearchContext.Provider>
  );
}
