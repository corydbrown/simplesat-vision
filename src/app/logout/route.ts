import { signOut } from "@workos-inc/authkit-nextjs";

/** Clears the AuthKit session cookie and bounces the user back through
 *  WorkOS to the configured logout URI (currently `http://localhost:3001`).
 *  `signOut` triggers the redirect internally via `next/navigation`. */
export async function GET() {
  await signOut({ returnTo: "/login" });
}
