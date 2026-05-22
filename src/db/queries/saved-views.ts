import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "../client";
import { WORKSPACE_ID } from "@/lib/workspace";
import type { EntityKey, SavedView, ViewState } from "@/lib/views/types";

function rowToView(row: typeof schema.savedViews.$inferSelect): SavedView {
  return {
    id: row.id,
    name: row.name,
    state: row.state as unknown as ViewState,
  };
}

export async function listSavedViews(entity: EntityKey): Promise<SavedView[]> {
  const rows = await db
    .select()
    .from(schema.savedViews)
    .where(
      and(
        eq(schema.savedViews.workspaceId, WORKSPACE_ID),
        eq(schema.savedViews.entity, entity),
      ),
    )
    .orderBy(
      asc(schema.savedViews.position),
      asc(schema.savedViews.createdAt),
    );
  return rows.map(rowToView);
}

/** Append-at-end create. Position is MAX(position)+1 so future reorder UI
 *  (SVP-48) has a stable starting layout. */
export async function createSavedView(
  entity: EntityKey,
  view: SavedView,
): Promise<SavedView> {
  const [{ maxPos }] = await db
    .select({
      maxPos: sql<number>`COALESCE(MAX(${schema.savedViews.position}), -1)`,
    })
    .from(schema.savedViews)
    .where(
      and(
        eq(schema.savedViews.workspaceId, WORKSPACE_ID),
        eq(schema.savedViews.entity, entity),
      ),
    );
  await db.insert(schema.savedViews).values({
    id: view.id,
    workspaceId: WORKSPACE_ID,
    entity,
    name: view.name,
    state: view.state as unknown as Record<string, unknown>,
    position: Number(maxPos) + 1,
  });
  return view;
}

export async function updateSavedView(
  entity: EntityKey,
  id: string,
  state: ViewState,
): Promise<void> {
  await db
    .update(schema.savedViews)
    .set({
      state: state as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.savedViews.workspaceId, WORKSPACE_ID),
        eq(schema.savedViews.entity, entity),
        eq(schema.savedViews.id, id),
      ),
    );
}

export async function renameSavedView(
  entity: EntityKey,
  id: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .update(schema.savedViews)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(
      and(
        eq(schema.savedViews.workspaceId, WORKSPACE_ID),
        eq(schema.savedViews.entity, entity),
        eq(schema.savedViews.id, id),
      ),
    );
}

export async function deleteSavedView(
  entity: EntityKey,
  id: string,
): Promise<void> {
  await db
    .delete(schema.savedViews)
    .where(
      and(
        eq(schema.savedViews.workspaceId, WORKSPACE_ID),
        eq(schema.savedViews.entity, entity),
        eq(schema.savedViews.id, id),
      ),
    );
}

/** Bulk replace used by the seed and localStorage-migration paths. Deletes
 *  the entity's existing rows for the workspace then re-inserts the array,
 *  assigning position by index. NOT for steady-state mutations — those go
 *  through the granular actions to preserve per-row timestamps. */
export async function replaceSavedViews(
  entity: EntityKey,
  views: SavedView[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.savedViews)
      .where(
        and(
          eq(schema.savedViews.workspaceId, WORKSPACE_ID),
          eq(schema.savedViews.entity, entity),
        ),
      );
    if (views.length === 0) return;
    await tx.insert(schema.savedViews).values(
      views.map((view, i) => ({
        id: view.id,
        workspaceId: WORKSPACE_ID,
        entity,
        name: view.name,
        state: view.state as unknown as Record<string, unknown>,
        position: i,
      })),
    );
  });
}
