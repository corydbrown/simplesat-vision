import { redirect } from "next/navigation";

/** Pre-SVP-228 the workspace's "default" scorecard had a dedicated route.
 *  That concept is gone (SVP-228): there's no fallback flag and choosing a
 *  "right" scorecard to redirect to without one is impossible. Bounce to the
 *  scorecards list instead so old deep-links + cached URLs don't 404. */
export default function DefaultScorecardRedirectPage() {
  redirect("/settings/scorecards");
}
