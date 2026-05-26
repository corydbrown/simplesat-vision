import { authkitProxy } from "@workos-inc/authkit-nextjs";

/** All app traffic flows through here. AuthKit reads the session cookie,
 *  refreshes the access token when needed, and redirects unauthenticated
 *  requests to the WorkOS sign-in flow. The original pathname is carried
 *  through WorkOS `state` so the user lands back where they intended
 *  after sign-in.
 *
 *  Next.js 16 renamed the `middleware` file/convention to `proxy`. See
 *  node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md. */
export default authkitProxy({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ["/login", "/callback", "/logout"],
  },
});

export const config = {
  /** Match every path except Next internals, image optimization, and
   *  favicon. AuthKit consults `unauthenticatedPaths` above to decide
   *  whether the request needs a session. */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
