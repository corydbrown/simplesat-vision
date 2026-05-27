import "server-only";

import type { User } from "@/db/schema";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace-id";

/** Local-development WorkOS bypass.
 *
 *  The app is WorkOS-gated (see `src/proxy.ts`), which makes local + headless
 *  worker testing painful: worktree ports can't complete the Google SSO
 *  callback, and an automated session can never click through Google at all.
 *
 *  So in development we skip WorkOS by default and inject a synthetic session.
 *  This is **ON by default** when `NODE_ENV !== "production"` — `next dev` and
 *  worker sessions Just Work with no per-worktree config. Set
 *  `DEV_AUTH_BYPASS=0` locally to exercise the real WorkOS flow.
 *
 *  Safety: the gate is hard-bound to `NODE_ENV !== "production"`. Vercel builds
 *  (production AND preview deployments) run with `NODE_ENV=production`, so the
 *  bypass can never open on a deploy. The production auth seam is untouched —
 *  only the local implementation is cheap. */
export const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "0";

/** Stable synthetic user returned by `getCurrentUser()` in bypass mode. Not
 *  persisted — works even against an empty local `users` table (the seed is
 *  currently broken repo-wide), so it must never be looked up in the DB. */
export const DEV_USER: User = {
  id: "usr_dev_bypass",
  workosId: "dev_bypass",
  email: "dev@localhost",
  name: "Dev User",
  avatarUrl: null,
  createdAt: new Date(0),
  lastSeenAt: null,
};

/** Workspace the bypass lands in when no selection cookie is present. Bloom is
 *  the data-rich demo workspace; the sidebar switcher overrides via the signed
 *  cookie, so workspace switching still works normally in bypass mode. */
export const DEV_DEFAULT_WORKSPACE_ID = DEMO_WORKSPACE_ID;
