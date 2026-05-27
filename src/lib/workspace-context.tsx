"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace-id";

/** Active workspace id fanned out from the server (workspace layout) to every
 *  client consumer. Two read paths:
 *   - `useWorkspaceId()` for React components/providers (column-prefs).
 *   - `getActiveWorkspaceIdClient()` for imperative, non-React code that needs
 *     the id synchronously (recent-pages record fns are fire-and-forget and
 *     run outside the React tree).
 *
 *  Persisted client state (column prefs, recent pages) is namespaced by this
 *  id so one workspace's preferences never bleed into another (SVP-192). */

// Module-level mirror kept in sync by the provider so imperative callers can
// read the active id without a hook. Set during the provider's render (not an
// effect) so a record() fired in the same commit sees the correct id.
let activeWorkspaceId: string | null = null;

/** Synchronous read of the active workspace id for imperative client code.
 *  Returns null before the provider has rendered (SSR / first tick). */
export function getActiveWorkspaceIdClient(): string | null {
  return activeWorkspaceId;
}

const WorkspaceContext = createContext<string | null>(null);

export function WorkspaceProvider({
  workspaceId,
  children,
}: {
  workspaceId: string | null;
  children: ReactNode;
}) {
  // Render-phase assignment: idempotent and single-valued. Deliberately NOT in
  // an effect — child effects fire before parent effects, so a detail page's
  // recordEntityView() would run before this provider's effect set the id,
  // recording under the wrong namespace. Render-phase guarantees the mirror is
  // set before any descendant commits.
  // eslint-disable-next-line react-hooks/globals
  activeWorkspaceId = workspaceId;

  useEffect(() => {
    migrateLegacyClientKeys();
  }, []);

  return (
    <WorkspaceContext.Provider value={workspaceId}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceId(): string | null {
  return useContext(WorkspaceContext);
}

const MIGRATION_FLAG = "simplesat:ws-migrated:v1";
const COLS_PREFIX = "simplesat:cols:";
const RECENT_PAGES_KEY = "simplesat:recent-pages";

/** One-shot, browser-local migration of pre-SVP-192 un-namespaced client keys
 *  under the Bloom workspace id. Today's usage is effectively single-workspace
 *  (Bloom), so this preserves the current user's column layouts + recent pages
 *  instead of dropping them. Idempotent and guarded by a flag.
 *
 *  Legacy column keys are `simplesat:cols:<tableId>` (tableIds never contain a
 *  colon); namespaced keys are `simplesat:cols:<workspaceId>:<tableId>`. So a
 *  colon-free suffix marks a legacy key. The recent-pages key is a single fixed
 *  key with no namespace segment. */
function migrateLegacyClientKeys(): void {
  if (typeof window === "undefined") return;
  try {
    const ls = window.localStorage;
    if (ls.getItem(MIGRATION_FLAG)) return;

    // Snapshot keys first — we mutate localStorage below, which shifts indices.
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k) keys.push(k);
    }

    const moves: Array<[from: string, to: string]> = [];
    for (const k of keys) {
      if (k.startsWith(COLS_PREFIX)) {
        const suffix = k.slice(COLS_PREFIX.length);
        if (!suffix.includes(":")) {
          moves.push([k, `${COLS_PREFIX}${DEMO_WORKSPACE_ID}:${suffix}`]);
        }
      } else if (k === RECENT_PAGES_KEY) {
        moves.push([k, `${RECENT_PAGES_KEY}:${DEMO_WORKSPACE_ID}`]);
      }
    }

    for (const [from, to] of moves) {
      const value = ls.getItem(from);
      // Don't clobber an already-namespaced value if one somehow exists.
      if (value !== null && ls.getItem(to) === null) ls.setItem(to, value);
      ls.removeItem(from);
    }

    ls.setItem(MIGRATION_FLAG, "1");
  } catch {
    // Best-effort; a failed migration just means defaults on next load.
  }
}
