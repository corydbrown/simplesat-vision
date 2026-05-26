import { redirect } from "next/navigation";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";

import { safeReturnPath } from "@/lib/auth";

/** Deep-link entry point for the WorkOS sign-in flow. The proxy already
 *  redirects unauthenticated requests directly to WorkOS, but `/login`
 *  remains a stable URL so external links, the eventual sign-out
 *  destination, and any "log in again" affordances all work without
 *  hard-coding the AuthKit URL.
 *
 *  Lives as a route handler (not a page) because `getSignInUrl` sets the
 *  AuthKit code-verifier cookie, which is only allowed in Route Handlers
 *  / Server Actions. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get("from")) ?? "/tickets";
  const signInUrl = await getSignInUrl({ returnTo });
  redirect(signInUrl);
}
