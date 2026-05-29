import { authkitProxy } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextMiddleware } from "next/server";

/** Local-dev WorkOS bypass — mirrors `DEV_AUTH_BYPASS` in `src/lib/dev-auth.ts`
 *  (the flag is recomputed here rather than imported so this middleware module
 *  stays free of the `server-only` import). ON by default in development, OFF
 *  whenever `NODE_ENV === "production"` (all Vercel builds), so it can never
 *  open on a deploy. `DEV_AUTH_BYPASS=0` opts back into the real flow locally. */
const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "0";

/** SVP-271 legacy redirect: `/coaching` → `/evaluations`. The old route was
 *  renamed when "Coaching" became "Evaluations" (Quality epic Phase 1.5).
 *  308 is permanent so browsers + crawlers cache the rewrite. Query string and
 *  any sub-path (e.g. `/coaching/<evalId>`) ride along unchanged. Runs ahead of
 *  AuthKit so the redirect target — not the legacy path — is what gets stashed
 *  in WorkOS's `state` if the user is unauthenticated. */
function withLegacyCoachingRedirect(next: NextMiddleware): NextMiddleware {
  return (request, event) => {
    const { pathname } = request.nextUrl;
    if (pathname === "/coaching" || pathname.startsWith("/coaching/")) {
      const target = request.nextUrl.clone();
      target.pathname = pathname.replace(/^\/coaching/, "/evaluations");
      return NextResponse.redirect(target, 308);
    }
    return next(request, event);
  };
}

const devAuthBypassProxy: NextMiddleware = function devAuthBypassProxy() {
  return NextResponse.next();
};

/** All app traffic flows through here. AuthKit reads the session cookie,
 *  refreshes the access token when needed, and redirects unauthenticated
 *  requests to the WorkOS sign-in flow. The original pathname is carried
 *  through WorkOS `state` so the user lands back where they intended
 *  after sign-in.
 *
 *  In dev-bypass mode the proxy is a pass-through (no redirect); the synthetic
 *  session is supplied app-side by `getCurrentUser()` / `getActiveWorkspaceId()`.
 *
 *  Next.js 16 renamed the `middleware` file/convention to `proxy`. See
 *  node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md. */
export default withLegacyCoachingRedirect(
  DEV_AUTH_BYPASS
    ? devAuthBypassProxy
    : authkitProxy({
        middlewareAuth: {
          enabled: true,
          unauthenticatedPaths: [
            "/login",
            "/callback",
            "/logout",
            // Ingest API: authenticated by a workspace API key (Bearer), NOT the
            // WorkOS session cookie. These must bypass the AuthKit redirect or n8n's
            // POSTs would be 302'd to the sign-in flow. Auth is enforced per-route by
            // `authenticateApiKey` — the key IS the workspace identity. Listed
            // explicitly (not a glob) so the cookie-authed internal `/api/*` routes
            // (search, drawer, qa, …) keep their session protection.
            "/api/tickets",
            "/api/customers",
            "/api/team-members",
            "/api/messages",
            "/api/responses",
          ],
        },
      }),
);

export const config = {
  /** Match every path except Next internals, image optimization, and
   *  favicon. AuthKit consults `unauthenticatedPaths` above to decide
   *  whether the request needs a session. */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
