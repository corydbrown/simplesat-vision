import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "../client";
import type { EntityKey, SavedView, ViewState } from "@/lib/views/types";

/** Pure, workspace-id-parameterized saved-view query core. No `server-only`,
 *  no `@/lib/workspace` import — so it's safe to import from background jobs
 *  that run outside Next's request scope (notably `db/seed.ts` under tsx).
 *  The request-scoped facade in `./saved-views.ts` resolves `workspaceId` via
 *  `requireWorkspace()` and delegates here; the seed passes
 *  `DEMO_WORKSPACE_ID` directly. */

function rowToView(row: typeof schema.savedViews.$inferSelect): SavedView {
  return {
    id: row.id,
    name: row.name,
    state: row.state as unknown as ViewState,
    position: row.position,
  };
}

export async function listSavedViews(
  workspaceId: string,
  entity: EntityKey,
): Promise<SavedView[]> {
  const rows = await db
    .select()
    .from(schema.savedViews)
    .where(
      and(
        eq(schema.savedViews.workspaceId, workspaceId),
        eq(schema.savedViews.entity, entity),
      ),
    )
    .orderBy(
      asc(schema.savedViews.position),
      asc(schema.savedViews.createdAt),
    );
  return rows.map(rowToView);
}

export type SavedViewsByEntity = Record<EntityKey, SavedView[]>;

function emptySavedViewsByEntity(): SavedViewsByEntity {
  return {
    tickets: [],
    customers: [],
    responses: [],
    "team-members": [],
    coaching: [],
  };
}

/** Single-round-trip variant of listSavedViews — returns every entity's
 *  saved views at once. The ViewsProvider hydration path uses this so the
 *  first paint pays for one server action + one DB query instead of five
 *  parallel ones (SVP-162). Server-side ORDER BY mirrors listSavedViews;
 *  we re-group by entity in memory after the fetch. */
export async function listAllSavedViews(
  workspaceId: string,
): Promise<SavedViewsByEntity> {
  // No entity filter — savedViews.entity is constrained by the column enum,
  // and we want every entity's rows anyway. Group in memory after the fetch.
  const rows = await db
    .select()
    .from(schema.savedViews)
    .where(eq(schema.savedViews.workspaceId, workspaceId))
    .orderBy(
      asc(schema.savedViews.entity),
      asc(schema.savedViews.position),
      asc(schema.savedViews.createdAt),
    );

  const byEntity = emptySavedViewsByEntity();
  for (const row of rows) {
    byEntity[row.entity as EntityKey].push(rowToView(row));
  }
  return byEntity;
}

/** Append-at-end create. Position is MAX(position)+1 so the sidebar drag-
 *  reorder UI (SVP-33) keeps newly created views below the existing manual
 *  order instead of shuffling them in alphabetically. */
export async function createSavedView(
  workspaceId: string,
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
        eq(schema.savedViews.workspaceId, workspaceId),
        eq(schema.savedViews.entity, entity),
      ),
    );
  const position = Number(maxPos) + 1;
  await db.insert(schema.savedViews).values({
    id: view.id,
    workspaceId,
    entity,
    name: view.name,
    state: view.state as unknown as Record<string, unknown>,
    position,
  });
  return { ...view, position };
}

export async function updateSavedView(
  workspaceId: string,
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
        eq(schema.savedViews.workspaceId, workspaceId),
        eq(schema.savedViews.entity, entity),
        eq(schema.savedViews.id, id),
      ),
    );
}

export async function renameSavedView(
  workspaceId: string,
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
        eq(schema.savedViews.workspaceId, workspaceId),
        eq(schema.savedViews.entity, entity),
        eq(schema.savedViews.id, id),
      ),
    );
}

export async function deleteSavedView(
  workspaceId: string,
  entity: EntityKey,
  id: string,
): Promise<void> {
  await db
    .delete(schema.savedViews)
    .where(
      and(
        eq(schema.savedViews.workspaceId, workspaceId),
        eq(schema.savedViews.entity, entity),
        eq(schema.savedViews.id, id),
      ),
    );
}

/** Rewrites every row's `position` for `entity` based on its index in `ids`.
 *  Runs in a transaction so a partial reorder can't leave the sidebar in a
 *  half-applied state. Rows not present in `ids` are left at their existing
 *  position — callers (the views provider) always pass the full list. */
export async function reorderSavedViews(
  workspaceId: string,
  entity: EntityKey,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(schema.savedViews)
        .set({ position: i, updatedAt: new Date() })
        .where(
          and(
            eq(schema.savedViews.workspaceId, workspaceId),
            eq(schema.savedViews.entity, entity),
            eq(schema.savedViews.id, ids[i]),
          ),
        );
    }
  });
}

/** Bulk replace used by the seed and localStorage-migration paths. Deletes
 *  the entity's existing rows for the workspace then re-inserts the array,
 *  assigning position by index. NOT for steady-state mutations — those go
 *  through the granular actions to preserve per-row timestamps. */
export async function replaceSavedViews(
  workspaceId: string,
  entity: EntityKey,
  views: SavedView[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.savedViews)
      .where(
        and(
          eq(schema.savedViews.workspaceId, workspaceId),
          eq(schema.savedViews.entity, entity),
        ),
      );
    if (views.length === 0) return;
    await tx.insert(schema.savedViews).values(
      views.map((view, i) => ({
        id: view.id,
        workspaceId,
        entity,
        name: view.name,
        state: view.state as unknown as Record<string, unknown>,
        position: i,
      })),
    );
  });
}
