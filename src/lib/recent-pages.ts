"use client";

import { useEffect, useState } from "react";

const KEY = "simplesat:recent-pages";
const CAP = 10;
// Custom event for same-tab updates. The browser's "storage" event fires
// only in OTHER tabs that share the origin, not in the writing tab itself,
// so we dispatch this in addition to the localStorage write.
const CHANGE_EVENT = "simplesat:recent-pages:changed";

export type RecentEntity =
  | "customer"
  | "ticket"
  | "team-member"
  | "response"
  | "survey";

export type RecentEntityEntry = {
  kind: "entity";
  entity: RecentEntity;
  id: string;
  label: string;
  secondary?: string;
  avatarColor?: string;
  viewedAt: number;
};

export type RecentPageEntry = {
  kind: "page";
  // Canonical href used as dedupe key. Rendering metadata (label, icon,
  // secondary) is looked up against STATIC_INDEX at render time so the
  // displayed values can't drift from the live nav definitions.
  href: string;
  viewedAt: number;
};

export type RecentEntry = RecentEntityEntry | RecentPageEntry;

function isValidEntity(v: unknown): v is RecentEntity {
  return (
    v === "customer" ||
    v === "ticket" ||
    v === "team-member" ||
    v === "response" ||
    v === "survey"
  );
}

function isValidEntry(v: unknown): v is RecentEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  if (typeof e.viewedAt !== "number") return false;
  if (e.kind === "entity") {
    return (
      isValidEntity(e.entity) &&
      typeof e.id === "string" &&
      typeof e.label === "string"
    );
  }
  if (e.kind === "page") {
    return typeof e.href === "string";
  }
  return false;
}

function dedupKey(e: RecentEntry): string {
  return e.kind === "entity"
    ? `entity:${e.entity}:${e.id}`
    : `page:${e.href}`;
}

function load(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

function save(list: RecentEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

function upsert(entry: RecentEntry): void {
  if (typeof window === "undefined") return;
  const key = dedupKey(entry);
  const current = load();
  const filtered = current.filter((e) => dedupKey(e) !== key);
  filtered.unshift(entry);
  save(filtered.slice(0, CAP));
}

export function recordEntityView(
  entry: Omit<RecentEntityEntry, "kind" | "viewedAt">,
): void {
  upsert({ ...entry, kind: "entity", viewedAt: Date.now() });
}

export function recordPageView(href: string): void {
  upsert({ kind: "page", href, viewedAt: Date.now() });
}

export function clearRecentPages(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

export function useRecentPages(): RecentEntry[] {
  const [list, setList] = useState<RecentEntry[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(load());
    const onChange = () => setList(load());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setList(load());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return list;
}
