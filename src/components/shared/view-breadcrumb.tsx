"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "./toast";
import { useViews } from "@/lib/views/provider";
import { ALL_VIEW_LABEL } from "@/lib/views/seed";
import { ALL_VIEW_ID, type EntityKey } from "@/lib/views/types";
import { VIEW_ID_PARAM } from "@/lib/views/url";

/** Renders the active view's name as the trailing breadcrumb. Click flips
 *  it into an inline input; Enter or blur commits the rename. The
 *  hardcoded "All ENTITY" view is non-editable — clicks fall through. */
export function ViewBreadcrumb({ entityKey }: { entityKey: EntityKey }) {
  const searchParams = useSearchParams();
  const { getView, renameView } = useViews();
  const toast = useToast();

  const viewId = searchParams.get(VIEW_ID_PARAM) ?? ALL_VIEW_ID;
  const savedView = viewId === ALL_VIEW_ID ? null : getView(entityKey, viewId);

  // Stale view id (deleted, never existed) — fall back to "All ENTITY".
  const isImmutable = viewId === ALL_VIEW_ID || !savedView;
  const displayName = savedView?.name ?? ALL_VIEW_LABEL[entityKey];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  // When the active view changes (or its persisted name updates from
  // another surface), keep the draft in sync until the next edit. This is
  // a true sync-with-external-source: the display name comes from
  // localStorage via context, not from rendering input.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(displayName);
  }, [displayName, editing]);

  function startEdit() {
    if (isImmutable) return;
    setDraft(displayName);
    setEditing(true);
    // Defer focus + select until after the input mounts.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function commit() {
    if (!editing || !savedView) {
      setEditing(false);
      return;
    }
    const next = draft.trim();
    if (!next || next === savedView.name) {
      setEditing(false);
      setDraft(savedView.name);
      return;
    }
    renameView(entityKey, savedView.id, next);
    toast(`Renamed to "${next}"`);
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
    setDraft(displayName);
  }

  if (editing && !isImmutable) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className="h-6 min-w-0 rounded border border-border bg-background px-1 text-base text-foreground outline-none ring-1 ring-transparent focus:ring-ring"
        style={{ width: `${Math.max(draft.length, 4) + 1}ch` }}
        aria-label="Rename view"
      />
    );
  }

  return (
    <span
      onClick={isImmutable ? undefined : startEdit}
      className={
        isImmutable
          ? "truncate text-foreground"
          : "cursor-text truncate rounded px-1 text-foreground -mx-1 hover:bg-accent/60"
      }
      title={isImmutable ? undefined : "Click to rename"}
    >
      {displayName}
    </span>
  );
}
