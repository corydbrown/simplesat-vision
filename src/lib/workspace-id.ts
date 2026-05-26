/** Stable id for the seeded Bloom Beauty workspace. Migration backfill points
 *  every pre-existing row at this id, and the seed re-creates it on reset.
 *
 *  Lives in its own zero-dep file because `src/db/seed.ts` runs under tsx
 *  outside Next's request scope — it can't import anything that pulls in
 *  `next/headers` or `@workos-inc/authkit-nextjs`. Server code re-exports
 *  this from `src/lib/workspace.ts` so callers have a single canonical
 *  import path. */
export const DEMO_WORKSPACE_ID = "wks_bloom_beauty";
