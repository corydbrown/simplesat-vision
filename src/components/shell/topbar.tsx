import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { HistoryNav } from "./back-button";
import { SidebarToggle } from "./sidebar-toggle";

export type Crumb = {
  label: string;
  href?: string;
  /** When provided, replaces the rendered text — used for interactive
   *  crumbs (e.g. click-to-rename view name). `label` is still required
   *  as a fallback for screen readers and SSR. */
  node?: React.ReactNode;
};

export function Topbar({
  crumbs,
  actions,
}: {
  crumbs: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-gutter text-base">
      <SidebarToggle />
      <HistoryNav />
      <div className="flex flex-1 items-center gap-1 px-1 min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && (
              <ChevronRight
                size={14}
                className="shrink-0 text-muted-foreground"
              />
            )}
            {c.node ? (
              c.node
            ) : c.href ? (
              <Link
                href={c.href}
                className="truncate text-muted-foreground hover:text-foreground"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={`truncate ${
                  i === crumbs.length - 1
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {c.label}
              </span>
            )}
          </span>
        ))}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}
