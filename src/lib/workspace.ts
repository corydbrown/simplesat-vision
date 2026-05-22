/** Hardcoded workspace identifier for the prototype. Every server-side row
 *  that participates in workspace-scoped storage (saved views today, more to
 *  come) carries this value. The eventual multi-tenant cutover replaces this
 *  constant with a resolved-from-session value — schema stays the same.
 *  See SVP-30. */
export const WORKSPACE_ID = "demo";
