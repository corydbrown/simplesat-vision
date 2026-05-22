"use server";

import {
  createSavedView as createSavedViewQuery,
  deleteSavedView as deleteSavedViewQuery,
  listSavedViews as listSavedViewsQuery,
  renameSavedView as renameSavedViewQuery,
  replaceSavedViews as replaceSavedViewsQuery,
  updateSavedView as updateSavedViewQuery,
} from "@/db/queries/saved-views";
import type { EntityKey, SavedView, ViewState } from "./types";

export async function listSavedViews(entity: EntityKey): Promise<SavedView[]> {
  return listSavedViewsQuery(entity);
}

export async function createSavedView(
  entity: EntityKey,
  view: SavedView,
): Promise<SavedView> {
  return createSavedViewQuery(entity, view);
}

export async function updateSavedView(
  entity: EntityKey,
  id: string,
  state: ViewState,
): Promise<void> {
  return updateSavedViewQuery(entity, id, state);
}

export async function renameSavedView(
  entity: EntityKey,
  id: string,
  name: string,
): Promise<void> {
  return renameSavedViewQuery(entity, id, name);
}

export async function deleteSavedView(
  entity: EntityKey,
  id: string,
): Promise<void> {
  return deleteSavedViewQuery(entity, id);
}

export async function replaceSavedViews(
  entity: EntityKey,
  views: SavedView[],
): Promise<void> {
  return replaceSavedViewsQuery(entity, views);
}
