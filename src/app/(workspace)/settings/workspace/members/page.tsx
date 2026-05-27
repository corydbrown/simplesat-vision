import { redirect } from "next/navigation";

// "Members" was renamed to "Users" and promoted to a top-level settings route
// (SVP-164). Keep this redirect so old links don't 404.
export default function WorkspaceMembersRedirect() {
  redirect("/settings/users");
}
