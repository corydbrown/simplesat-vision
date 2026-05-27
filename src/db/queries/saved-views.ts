import "server-only";
import { requireWorkspace } from "@/lib/workspace";
import type { EntityKey, SavedView, ViewState } from "@/lib/views/types";
import * as core from "./saved-views.core";

/** Request-scoped facade over the pure query core in `./saved-views.core`.
 *  Resolves the active workspace via `requireWorkspace()` then delegates.
 *  Signatures are deliberately workspace-id-free — callers in the running app
 *  (server actions, RSC) never pass a workspace id; it comes from the request.
 *  Background jobs that run outside request scope (the seed) import the core
 *  directly and pass `DEMO_WORKSPACE_ID`. */

export type { SavedViewsByEntity } from "./saved-views.core";

export async function listSavedViews(entity: EntityKey): Promise<SavedView[]> {
  return core.listSavedViews(await requireWorkspace(), entity);
}

export async function listAllSavedViews(): Promise<core.SavedViewsByEntity> {
  return core.listAllSavedViews(await requireWorkspace());
}

export async function createSavedView(
  entity: EntityKey,
  view: SavedView,
): Promise<SavedView> {
  return core.createSavedView(await requireWorkspace(), entity, view);
}

export async function updateSavedView(
  entity: EntityKey,
  id: string,
  state: ViewState,
): Promise<void> {
  return core.updateSavedView(await requireWorkspace(), entity, id, state);
}

export async function renameSavedView(
  entity: EntityKey,
  id: string,
  name: string,
): Promise<void> {
  return core.renameSavedView(await requireWorkspace(), entity, id, name);
}

export async function deleteSavedView(
  entity: EntityKey,
  id: string,
): Promise<void> {
  return core.deleteSavedView(await requireWorkspace(), entity, id);
}

export async function reorderSavedViews(
  entity: EntityKey,
  ids: string[],
): Promise<void> {
  return core.reorderSavedViews(await requireWorkspace(), entity, ids);
}

export async function replaceSavedViews(
  entity: EntityKey,
  views: SavedView[],
): Promise<void> {
  return core.replaceSavedViews(await requireWorkspace(), entity, views);
}
