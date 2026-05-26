"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Workspace", href: "/settings/workspace", match: "/settings/workspace" },
  {
    label: "Members",
    href: "/settings/workspace/members",
    match: "/settings/workspace/members",
  },
] as const;

/** Linear-style sub-nav under Workspace settings. Sits at the top of the
 *  Workspace settings content area; future tabs (Integrations, Billing) plug
 *  in by extending TABS above. */
export function WorkspaceSubNav() {
  const pathname = usePathname();
  // Members route is a sub-path of /settings/workspace, so the "Workspace"
  // tab is active only when the path is exactly /settings/workspace (or a
  // future leaf that isn't its own tab). Tabs declared later in the array
  // win when their match prefix is more specific.
  const active = [...TABS]
    .reverse()
    .find((t) => pathname === t.match || pathname.startsWith(`${t.match}/`));

  return (
    <nav className="border-b border-border">
      <ul className="flex items-end gap-6">
        {TABS.map((tab) => {
          const isActive = active?.href === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`-mb-px inline-flex h-9 cursor-pointer items-center border-b-2 px-1 text-base transition-colors ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
