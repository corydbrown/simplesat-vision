"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Settings2, type LucideIcon } from "lucide-react";

type SettingsNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match prefix — active when `pathname` starts with this. Falls back to
   *  exact match against `href` when omitted. */
  match?: string;
};

const ITEMS: SettingsNavItem[] = [
  {
    id: "workspace",
    label: "Workspace",
    href: "/settings/workspace",
    icon: Settings2,
    match: "/settings/workspace",
  },
  {
    id: "scorecards",
    label: "Scorecards",
    href: "/settings/scorecards",
    icon: ClipboardCheck,
    match: "/settings/scorecards",
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 border-r border-border bg-background px-2 py-6">
      <div className="px-2 pb-2 text-base font-medium text-muted-foreground/80">
        Workspace
      </div>
      <div className="flex flex-col gap-0.5">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const match = item.match ?? item.href;
          const active = pathname.startsWith(match);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex h-7 cursor-pointer items-center gap-2 rounded px-2 transition-colors ${
                active
                  ? "bg-accent text-foreground font-medium"
                  : "text-foreground/80 hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
