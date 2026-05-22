"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ViewActionsMenu } from "./view-actions-menu";
import { useViews } from "@/lib/views/provider";
import { ALL_VIEW_ID, type EntityKey } from "@/lib/views/types";
import { VIEW_ID_PARAM } from "@/lib/views/url";

/** Topbar page-actions affordance for list pages. Mirrors `DetailActions`
 *  on detail pages: ghost icon button on the right of the breadcrumbs row,
 *  opening a dropdown of per-page actions. v1 ships Rename / Delete; future
 *  items (Change layout, Duplicate, Export) drop in here as additional
 *  `DropdownMenuItem`s.
 *
 *  When the active view is the immutable "All ENTITY" view, the menu has
 *  nothing to offer and the component renders nothing rather than a
 *  disabled stub. */
export function ListPageActions({
  entityKey,
  basePath,
}: {
  entityKey: EntityKey;
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getView } = useViews();

  const viewId = searchParams.get(VIEW_ID_PARAM) ?? ALL_VIEW_ID;
  const savedView = viewId === ALL_VIEW_ID ? null : getView(entityKey, viewId);

  // Stale view id (deleted elsewhere, or never existed) reads as "All" too.
  if (!savedView) return null;

  return (
    <ViewActionsMenu
      entity={entityKey}
      view={savedView}
      align="end"
      onDeleted={() => router.push(basePath, { scroll: false })}
    >
      <button
        type="button"
        aria-label="View actions"
        title="View actions"
        className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <MoreHorizontal size={16} />
      </button>
    </ViewActionsMenu>
  );
}
