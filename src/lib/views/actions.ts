"use server";

import { z } from "zod";
import {
  createSavedView as createSavedViewQuery,
  deleteSavedView as deleteSavedViewQuery,
  listSavedViews as listSavedViewsQuery,
  renameSavedView as renameSavedViewQuery,
  reorderSavedViews as reorderSavedViewsQuery,
  replaceSavedViews as replaceSavedViewsQuery,
  updateSavedView as updateSavedViewQuery,
} from "@/db/queries/saved-views";
import {
  CreateInputSchema,
  DeleteInputSchema,
  EntitySchema,
  RenameInputSchema,
  ReorderInputSchema,
  ReplaceAllInputSchema,
  UpdateInputSchema,
} from "./schemas";
import type { EntityKey, SavedView, ViewState } from "./types";

/** Run input through a zod schema before it reaches Drizzle. On ZodError we
 *  surface a generic message so server-side validation details never leak to
 *  the client — but log the full issue list to the server console for
 *  debugging. Set the validation rail NOW so future server actions in this
 *  codebase copy the pattern as auth + multi-tenant land. */
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("[saved-views action] invalid input", err.issues);
      throw new Error("Invalid input");
    }
    throw err;
  }
}

export async function listSavedViews(entity: EntityKey): Promise<SavedView[]> {
  const validated = validate(EntitySchema, entity);
  return listSavedViewsQuery(validated);
}

export async function createSavedView(
  entity: EntityKey,
  view: SavedView,
): Promise<SavedView> {
  const input = validate(CreateInputSchema, { entity, view });
  return createSavedViewQuery(input.entity, input.view);
}

export async function updateSavedView(
  entity: EntityKey,
  id: string,
  state: ViewState,
): Promise<void> {
  const input = validate(UpdateInputSchema, { entity, id, state });
  return updateSavedViewQuery(input.entity, input.id, input.state);
}

export async function renameSavedView(
  entity: EntityKey,
  id: string,
  name: string,
): Promise<void> {
  const input = validate(RenameInputSchema, { entity, id, name });
  return renameSavedViewQuery(input.entity, input.id, input.name);
}

export async function deleteSavedView(
  entity: EntityKey,
  id: string,
): Promise<void> {
  const input = validate(DeleteInputSchema, { entity, id });
  return deleteSavedViewQuery(input.entity, input.id);
}

export async function replaceSavedViews(
  entity: EntityKey,
  views: SavedView[],
): Promise<void> {
  const input = validate(ReplaceAllInputSchema, { entity, views });
  return replaceSavedViewsQuery(input.entity, input.views);
}

export async function reorderSavedViews(
  entity: EntityKey,
  ids: string[],
): Promise<void> {
  const input = validate(ReorderInputSchema, { entity, ids });
  return reorderSavedViewsQuery(input.entity, input.ids);
}
