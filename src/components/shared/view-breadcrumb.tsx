"use client";

import { useSearchParams } from "next/navigation";
import { useViews } from "@/lib/views/provider";
import { ALL_VIEW_LABEL } from "@/lib/views/seed";
import { ALL_VIEW_ID, type EntityKey } from "@/lib/views/types";
import { VIEW_ID_PARAM } from "@/lib/views/url";

/** Renders the active view's name as the trailing breadcrumb. Display-only —
 *  renaming happens via the Dialog in ListPageActions / SidebarViewKebab. */
export function ViewBreadcrumb({ entityKey }: { entityKey: EntityKey }) {
  const searchParams = useSearchParams();
  const { getView } = useViews();

  const viewId = searchParams.get(VIEW_ID_PARAM) ?? ALL_VIEW_ID;
  const savedView = viewId === ALL_VIEW_ID ? null : getView(entityKey, viewId);
  const displayName = savedView?.name ?? ALL_VIEW_LABEL[entityKey];

  return <span className="truncate text-foreground">{displayName}</span>;
}
